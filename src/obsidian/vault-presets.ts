import { App, normalizePath, Notice, Plugin, stringifyYaml, TFile } from "obsidian";
import { PLUGIN_NAME, PRESET_RELOAD_DEBOUNCE_MS } from "../constants";
import {
  PRESET_MARKER_KEY,
  presetFrontmatter,
  validatePresetSet,
  type NewPresetInput,
  type Preset,
  type PresetIssue,
  type PresetSetResult,
} from "../core/presets";
import { installedAfter, planStarterSync, type StarterAction } from "../core/starters-plan";
import { sanitizeFilename } from "../core/filename";
import type { Logger } from "../logger";
import { STARTERS } from "../starters";

/** Normalize a vault folder setting ("" = vault root); null when it would leave the vault. */
export function vaultFolderPath(setting: string): string | null {
  const raw = setting.trim();
  if (raw === "" || raw === "/") return "";
  if (raw.split(/[\\/]/).some((part) => part === "..")) return null;
  const path = normalizePath(raw);
  return path === "/" ? "" : path;
}

function inFolder(path: string, folder: string): boolean {
  return folder === "" ? true : path.startsWith(`${folder}/`);
}

/**
 * Loads and watches preset files (SPEC 3.3): Markdown files in the presets folder whose
 * frontmatter has the `selective-print-preset` key. Invalid presets are reported and skipped.
 */
export class PresetStore {
  private result: PresetSetResult = { presets: [], errors: [], warnings: [] };
  private timer: number | undefined;

  constructor(
    private readonly app: App,
    private readonly folderSetting: () => string,
    private readonly log: Logger,
  ) {}

  get presets(): Preset[] {
    return this.result.presets;
  }

  get report(): PresetSetResult {
    return this.result;
  }

  folder(): string | null {
    return vaultFolderPath(this.folderSetting());
  }

  /** Preset files (valid or not) in the folder. */
  files(): TFile[] {
    const folder = this.folder();
    if (folder === null) return [];
    return this.app.vault.getMarkdownFiles().filter((f) => {
      if (!inFolder(f.path, folder)) return false;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      return fm !== undefined && PRESET_MARKER_KEY in fm;
    });
  }

  private generation = 0;

  /**
   * Re-read every preset file. Files whose frontmatter Obsidian could not parse but that
   * mention the preset marker are reported as errors rather than silently ignored.
   */
  async reload(): Promise<void> {
    try {
      await this.load();
    } catch (err) {
      // Never reject: callers fire this from events. Report through the validation result.
      this.log.error("loading presets failed", err);
      this.result = {
        presets: [],
        errors: [
          {
            file: this.folderSetting(),
            field: "(folder)",
            message: `presets could not be loaded: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        warnings: [],
      };
    }
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const folder = this.folder();
    if (folder === null) {
      this.result = {
        presets: [],
        errors: [
          {
            file: this.folderSetting(),
            field: "presets folder",
            message: "points outside the vault",
          },
        ],
        warnings: [],
      };
      return;
    }
    const entries: { file: string; frontmatter: unknown }[] = [];
    const unreadable: PresetIssue[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!inFolder(f.path, folder)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm !== undefined) {
        if (PRESET_MARKER_KEY in fm) entries.push({ file: f.path, frontmatter: fm });
      } else if ((await this.app.vault.cachedRead(f)).includes(PRESET_MARKER_KEY)) {
        unreadable.push({
          file: f.path,
          field: "(frontmatter)",
          message: "the frontmatter could not be read; check the YAML syntax",
        });
      }
    }
    if (generation !== this.generation) return; // a newer reload started meanwhile
    const result = validatePresetSet(entries);
    result.errors.unshift(...unreadable);
    this.result = result;
    this.log.debug(
      `presets loaded: ${result.presets.length} valid, ${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
  }

  /** Reload on any change to a file in the presets folder (debounced). */
  watch(plugin: Plugin): void {
    const schedule = (path: string): void => {
      const folder = this.folder();
      if (folder === null || !inFolder(path, folder)) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.reload(), PRESET_RELOAD_DEBOUNCE_MS);
    };
    plugin.registerEvent(this.app.metadataCache.on("changed", (file) => schedule(file.path)));
    plugin.registerEvent(this.app.vault.on("delete", (file) => schedule(file.path)));
    plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        schedule(file.path);
        schedule(oldPath);
      }),
    );
    plugin.register(() => window.clearTimeout(this.timer));
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (folder === "" || this.app.vault.getFolderByPath(folder)) return;
    await this.app.vault.createFolder(folder);
  }

  /** Create a preset file from dialog choices. Never overwrites; returns the new file. */
  async createPreset(input: NewPresetInput): Promise<TFile> {
    const folder = this.folder();
    if (folder === null) throw new Error("the presets folder setting points outside the vault");
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder ? `${folder}/` : ""}${sanitizeFilename(input.name)}.md`);
    if (this.app.vault.getAbstractFileByPath(path))
      throw new Error(`a file named "${path}" already exists`);
    const body =
      "Created from the Selective Print dialog.\n\n" +
      "To apply it automatically, add an `applies-to` rule, for example:\n\n" +
      "```yaml\napplies-to:\n  - property: type\n    equals: meeting\n```\n";
    const file = await this.app.vault.create(
      path,
      `---\n${stringifyYaml(presetFrontmatter(input))}---\n${body}`,
    );
    return file;
  }

  /**
   * Install or refresh starter presets. "auto" (on load) adds new starters and upgrades
   * unmodified ones; "manual" also re-creates deleted ones and writes "(new starter)" copies
   * next to modified ones. Returns the actions taken and the new installed-version record.
   */
  async syncStarters(
    installed: Readonly<Record<string, number>>,
    mode: "auto" | "manual",
  ): Promise<{ actions: StarterAction[]; installed: Record<string, number> }> {
    const folder = this.folder();
    if (folder === null) throw new Error("the presets folder setting points outside the vault");
    const contents = new Map<string, string | null>();
    for (const s of STARTERS) {
      for (const file of [s.file, s.file.replace(/\.md$/i, "") + " (new starter).md"]) {
        const path = normalizePath(folder ? `${folder}/${file}` : file);
        const f = this.app.vault.getFileByPath(path);
        contents.set(path, f ? await this.app.vault.read(f) : null);
      }
    }
    const actions = planStarterSync({
      starters: STARTERS,
      folder,
      read: (p) => contents.get(normalizePath(p)) ?? null,
      installed,
      mode,
    });
    const writes = actions.filter((a) => a.kind !== "skip");
    if (writes.length) await this.ensureFolder(folder);
    for (const a of actions) {
      if (a.kind === "create" || a.kind === "compare") {
        await this.app.vault.create(normalizePath(a.path), a.content);
      } else if (a.kind === "update") {
        const f = this.app.vault.getFileByPath(normalizePath(a.path));
        if (f) await this.app.vault.modify(f, a.content);
      }
    }
    if (writes.length)
      this.log.debug(`starters: ${writes.map((a) => `${a.kind} ${a.path}`).join(", ")}`);
    return { actions, installed: installedAfter(installed, actions) };
  }
}

/** One-line summary of a starter sync for a Notice. */
export function describeStarterSync(actions: readonly StarterAction[]): string {
  const count = (k: StarterAction["kind"]): number => actions.filter((a) => a.kind === k).length;
  const parts = [
    count("create") && `${count("create")} installed`,
    count("update") && `${count("update")} updated`,
    count("compare") && `${count("compare")} new versions written next to your edited copies`,
  ].filter(Boolean);
  const modified = actions.filter((a) => a.kind === "skip" && a.reason === "modified").length;
  if (modified) parts.push(`${modified} edited by you, left alone`);
  return `${PLUGIN_NAME}: starter presets: ${parts.length ? parts.join(", ") : "already up to date"}.`;
}

export function noticeError(prefix: string, err: unknown): void {
  new Notice(`${PLUGIN_NAME}: ${prefix}: ${err instanceof Error ? err.message : String(err)}`);
}
