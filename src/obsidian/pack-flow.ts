import { App, Notice, TFile, TFolder } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import { renderFilename } from "../core/filename";
import { formatTimestamp, noteLocation, packLabels } from "../core/header-footer";
import { defaultJobForNote } from "../core/note-job";
import {
  linkpathOf,
  noteDate,
  packAnchor,
  packDateRange,
  PACK_CONFIRM_THRESHOLD,
  parsePackQuery,
  type PackNote,
} from "../core/pack";
import { conditionMatches, PRESET_MARKER_KEY } from "../core/presets";
import { parseSections } from "../core/sections";
import { validateRuleEntry } from "../core/selection";
import type { Logger } from "../logger";
import {
  checkAdapters,
  runWithFallback,
  type OutputAdapter,
  type OutputOptions,
} from "../output/adapter";
import type { SelectivePrintSettings } from "../settings";
import { confirm } from "../ui/ConfirmModal";
import { PackModal, type PackChoice } from "../ui/PackModal";
import { readNote } from "./note-source";
import { renderJob, type RenderResult } from "./render";
import { vaultFolderPath, type PresetStore } from "./vault-presets";

/** Where the notes of a pack come from. Folder packs can re-collect with or without subfolders. */
export interface PackSource {
  title: string;
  folder: TFolder | null;
  files: TFile[];
}

/**
 * Multi-note packs (0.6.0): collect notes, show the pack dialog, render every note with its own
 * defaults (or one preset for all), assemble cover, contents and notes into one document, and
 * hand it to the Print or PDF adapter. Wiring only; decisions live in src/core/pack.ts and
 * src/core/note-job.ts.
 */
export class PackFlow {
  constructor(
    private readonly app: App,
    private readonly settings: () => SelectivePrintSettings,
    private readonly adapters: () => OutputAdapter[],
    private readonly fallback: () => OutputAdapter,
    private readonly store: PresetStore,
    private readonly log: Logger,
  ) {}

  private isPresetFile(file: TFile): boolean {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm !== undefined && PRESET_MARKER_KEY in fm;
  }

  /** Markdown notes in a folder (optionally with subfolders), never preset files. */
  notesInFolder(folder: TFolder, recursive: boolean): TFile[] {
    const out: TFile[] = [];
    const walk = (f: TFolder): void => {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === "md" && !this.isPresetFile(child))
          out.push(child);
        else if (recursive && child instanceof TFolder) walk(child);
      }
    };
    walk(folder);
    return out;
  }

  toPackNote(file: TFile): PackNote {
    const cache = this.app.metadataCache.getFileCache(file);
    return {
      path: file.path,
      title: file.basename,
      properties: { ...(cache?.frontmatter ?? {}) },
      tags: cache ? this.tagsOf(file) : [],
      mtime: file.stat.mtime,
    };
  }

  private tagsOf(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const tags = new Set<string>();
    for (const t of cache?.tags ?? []) tags.add(t.tag);
    const fmTags: unknown = cache?.frontmatter?.tags;
    for (const t of Array.isArray(fmTags)
      ? fmTags
      : typeof fmTags === "string"
        ? fmTags.split(/[,\s]+/)
        : []) {
      if (typeof t === "string" && t.trim()) tags.add(t.trim());
    }
    return [...tags];
  }

  async startFolder(folder: TFolder): Promise<void> {
    const title = folder.isRoot() ? this.app.vault.getName() : folder.path;
    await this.open({ title, folder, files: this.notesInFolder(folder, false) });
  }

  async startFiles(files: TFile[]): Promise<void> {
    const notes = files.filter((f) => f.extension === "md" && !this.isPresetFile(f));
    const parents = new Set(notes.map((f) => f.parent?.path ?? ""));
    const title =
      parents.size === 1 ? [...parents][0] || this.app.vault.getName() : "Selected notes";
    await this.open({ title, folder: null, files: notes });
  }

  async startQuery(text: string): Promise<void> {
    const query = parsePackQuery(text);
    if (!query.ok) {
      new Notice(`${PLUGIN_NAME}: ${query.error}`);
      return;
    }
    const files = this.app.vault
      .getMarkdownFiles()
      .filter(
        (f) => !this.isPresetFile(f) && conditionMatches(query.condition, this.toPackNote(f)),
      );
    await this.open({ title: text.trim(), folder: null, files });
  }

  private async open(source: PackSource): Promise<void> {
    try {
      if (source.files.length === 0 && !source.folder) {
        new Notice(`${PLUGIN_NAME}: no notes to print.`);
        return;
      }
      const { available, unavailable } = await checkAdapters(this.adapters());
      for (const u of unavailable)
        this.log.debug(`adapter ${u.adapter.id} unavailable: ${u.reason}`);
      const wanted = this.settings().defaultOutput;
      const initialAdapter =
        available.find((a) => a.id === wanted) ?? available.find((a) => a.id === "print");
      if (!initialAdapter) throw new Error("no output adapter is available");
      const folder = source.folder;
      new PackModal(
        this.app,
        {
          title: source.title,
          notes: source.files.map((f) => this.toPackNote(f)),
          collect: folder
            ? (recursive) => this.notesInFolder(folder, recursive).map((f) => this.toPackNote(f))
            : null,
          presets: [...this.store.presets],
          adapters: available,
          initialAdapter,
        },
        (choice) => void this.confirmAndOutput(source, choice),
      ).open();
    } catch (err) {
      this.fail("could not open the pack", err);
    }
  }

  private async confirmAndOutput(source: PackSource, choice: PackChoice): Promise<void> {
    if (choice.notes.length > PACK_CONFIRM_THRESHOLD) {
      const ok = await confirm(
        this.app,
        "Print a large pack?",
        `This pack has ${choice.notes.length} notes. Rendering may take a while. Continue?`,
        "Continue",
      );
      if (!ok) return;
    }
    await this.output(source, choice);
  }

  private globalExclude(): string[] {
    return this.settings().globalExclude.filter(
      (e) => e.trim() !== "" && validateRuleEntry(e) === null,
    );
  }

  private async output(source: PackSource, choice: PackChoice): Promise<void> {
    const s = this.settings();
    const parts: RenderResult[] = [];
    const failures: string[] = [];
    let warningCount = 0;
    const progress = new Notice(`${PLUGIN_NAME}: rendering 0 of ${choice.notes.length}…`, 0);
    const printedAt = new Date();
    const anchors = new Map(choice.notes.map((n, i) => [n.path, packAnchor(i + 1)]));

    try {
      const pack = createDiv({
        cls: "markdown-preview-view markdown-rendered selective-print-content selective-print-pack",
      });

      if (choice.cover) {
        const cover = pack.createDiv({ cls: "selective-print-pack-cover" });
        cover.createEl("h1", { text: choice.title });
        const range = packDateRange(choice.notes);
        if (range)
          cover.createEl("p", {
            text: range.from === range.to ? range.from : `${range.from} – ${range.to}`,
          });
        cover.createEl("p", {
          text: `${choice.notes.length} ${choice.notes.length === 1 ? "note" : "notes"}`,
        });
        cover.createEl("p", { text: `Printed ${formatTimestamp(printedAt)}` });
      }
      if (choice.contents) {
        const toc = pack.createDiv({ cls: "selective-print-pack-toc" });
        toc.createEl("h2", { text: "Contents" });
        const list = toc.createEl("ol");
        choice.notes.forEach((n, i) => {
          const item = list.createEl("li");
          item.createEl("a", { text: n.title, href: `#${packAnchor(i + 1)}` });
          const date = noteDate(n);
          if (date) item.createSpan({ cls: "selective-print-toc-date", text: date });
        });
      }

      for (const [i, n] of choice.notes.entries()) {
        progress.setMessage(`${PLUGIN_NAME}: rendering ${i + 1} of ${choice.notes.length}…`);
        try {
          const file = this.app.vault.getFileByPath(n.path);
          if (!file) throw new Error("the note no longer exists");
          const note = await readNote(this.app, file);
          const { job, warnings } = defaultJobForNote({
            tree: parseSections(note.source),
            note: {
              path: note.file.path,
              title: note.title,
              properties: note.properties,
              tags: note.tags,
            },
            presets: this.store.presets,
            globalExclude: this.globalExclude(),
            settingsSkipEmpty: s.skipEmpty,
            presetOverride: choice.preset,
            includeTitle: false,
          });
          warningCount += warnings.length;
          for (const w of warnings) this.log.debug(`${n.path}: ${w}`);
          const rendered = await renderJob(this.app, job, note.file.path);
          parts.push(rendered);
          if (rendered.timedOut) warningCount++;
          this.rewriteLinks(rendered.content, note.file.path, anchors);

          const section = pack.createDiv({
            cls: `selective-print-pack-note${choice.newPage ? " is-new-page" : ""}`,
            attr: { id: packAnchor(i + 1) },
          });
          section.createEl("h1", { text: note.title, cls: "selective-print-title" });
          section.createDiv({
            cls: "selective-print-note-meta",
            text: `${noteLocation(note.file.path)} · Last modified ${formatTimestamp(new Date(note.file.stat.mtime))}`,
          });
          section.appendChild(rendered.content.cloneNode(true));
        } catch (err) {
          failures.push(`${n.title}: ${err instanceof Error ? err.message : String(err)}`);
          this.log.error(`pack: could not include ${n.path}`, err);
        }
      }
      progress.hide();

      for (const f of failures.slice(0, 5))
        new Notice(`${PLUGIN_NAME}: could not include ${f}`, 10000);
      if (failures.length > 5)
        new Notice(`${PLUGIN_NAME}: ${failures.length - 5} more notes could not be included.`);
      if (warningCount) {
        new Notice(
          `${PLUGIN_NAME}: ${warningCount} warnings while preparing the pack (turn on Debug logging for details).`,
        );
      }
      if (parts.length === 0) {
        new Notice(`${PLUGIN_NAME}: no notes could be rendered; nothing to print.`);
        return;
      }

      const options: OutputOptions = {
        paper: s.paper,
        orientation: s.orientation,
        marginsIn: s.marginsIn,
      };
      if (s.headerFooter)
        options.labels = packLabels({ title: choice.title, count: parts.length, printedAt });
      let primary = choice.adapter;
      if (primary.id === "pdf") {
        try {
          options.target = this.pdfTarget(source, choice.title);
        } catch (err) {
          new Notice(
            `${PLUGIN_NAME}: ${err instanceof Error ? err.message : String(err)}. Opening the print dialog instead.`,
          );
          primary = this.fallback();
        }
      }
      const result = await runWithFallback(
        primary,
        this.fallback(),
        { title: choice.title, content: pack, matchTheme: s.printStyle === "match-theme" },
        options,
        (message) => new Notice(`${PLUGIN_NAME}: ${message}`, 10000),
      );
      if (result.cancelled) return;
      if (!result.ok)
        new Notice(`${PLUGIN_NAME}: ${result.message ?? "the pack could not be output."}`);
      else if (result.path)
        new Notice(`${PLUGIN_NAME}: ${result.message ?? `saved ${result.path}`}`);
    } catch (err) {
      this.fail("could not print the pack", err);
    } finally {
      progress.hide();
      for (const p of parts) p.dispose();
    }
  }

  /** Links to notes inside the pack jump within the document (clickable in the PDF). */
  private rewriteLinks(
    root: HTMLElement,
    sourcePath: string,
    anchors: ReadonlyMap<string, string>,
  ): void {
    root.querySelectorAll("a.internal-link").forEach((a) => {
      const href = a.getAttribute("data-href") ?? a.getAttribute("href") ?? "";
      const dest = this.app.metadataCache.getFirstLinkpathDest(linkpathOf(href), sourcePath);
      const anchor = dest ? anchors.get(dest.path) : undefined;
      if (anchor) a.setAttribute("href", `#${anchor}`);
    });
  }

  private pdfTarget(source: PackSource, title: string): NonNullable<OutputOptions["target"]> {
    const s = this.settings();
    const { name } = renderFilename(s.filenameTemplate, { title, properties: {}, now: new Date() });
    if (s.pdfDestination !== "vault")
      return { kind: s.pdfDestination, name, openAfter: s.openPdfInPreview };
    let folder: string;
    if (s.pdfFolder.trim() === "") {
      const path = source.folder?.path ?? "";
      folder = path === "/" ? "" : path;
    } else {
      const resolved = vaultFolderPath(s.pdfFolder);
      if (resolved === null)
        throw new Error(`the PDF folder "${s.pdfFolder}" points outside the vault`);
      folder = resolved;
    }
    return { kind: "vault", folder, name, openAfter: s.openPdfInPreview };
  }

  private fail(what: string, err: unknown): void {
    this.log.error(what, err);
    new Notice(`${PLUGIN_NAME}: ${what}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
