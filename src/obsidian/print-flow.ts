import { App, Notice, TFile } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import { buildJob, type PrintJob } from "../core/job";
import { readNoteOverrides } from "../core/note-keys";
import {
  defaultPreset,
  matchPresets,
  orderForDropdown,
  presetNameProblem,
  type Preset,
} from "../core/presets";
import { parseSections } from "../core/sections";
import { finalSelection, resolveDefaults, validateRuleEntry } from "../core/selection";
import type { Logger } from "../logger";
import type { OutputAdapter } from "../output/adapter";
import type { SelectivePrintSettings } from "../settings";
import { promptForName } from "../ui/NamePromptModal";
import { ReviewModal } from "../ui/ReviewModal";
import { readNote, type NoteSnapshot } from "./note-source";
import { rememberExclusions } from "./note-writes";
import { renderJob } from "./render";
import type { PresetStore } from "./vault-presets";

/**
 * One invocation: read the note, compute defaults, optionally show the review dialog,
 * render, and hand off to the output adapter. Wiring only; decisions live in src/core.
 */
export class PrintFlow {
  constructor(
    private readonly app: App,
    private readonly settings: () => SelectivePrintSettings,
    private readonly adapters: () => OutputAdapter[],
    private readonly store: PresetStore,
    private readonly log: Logger,
  ) {}

  /** Valid global exclude entries (blank or invalid ones are skipped). */
  private globalExclude(): string[] {
    return this.settings().globalExclude.filter(
      (e) => e.trim() !== "" && validateRuleEntry(e) === null,
    );
  }

  private presetsFor(note: NoteSnapshot): { list: Preset[]; initial: Preset; notices: string[] } {
    const presets = this.store.presets;
    const match = matchPresets(presets, {
      path: note.file.path,
      properties: note.properties,
      tags: note.tags,
    });
    const notices: string[] = [];
    if (match.warning) notices.push(match.warning);
    const problems = this.store.report.errors.length;
    if (problems) {
      notices.push(
        `${problems} preset ${problems === 1 ? "problem" : "problems"} found; run "Validate print presets" for details.`,
      );
    }
    return { list: orderForDropdown(presets, match), initial: defaultPreset(match), notices };
  }

  async start(file: TFile, opts: { dialog: boolean }): Promise<void> {
    try {
      if (file.extension !== "md") {
        new Notice(`${PLUGIN_NAME}: only Markdown notes can be printed.`);
        return;
      }
      const note = await readNote(this.app, file);
      const tree = parseSections(note.source);
      const adapters = await this.availableAdapters();
      const overrides = readNoteOverrides(note.properties);
      const { list, initial, notices } = this.presetsFor(note);
      notices.push(...overrides.warnings.map((w) => w.message));
      const settings = this.settings();

      if (opts.dialog) {
        new ReviewModal(
          this.app,
          {
            note,
            tree,
            presets: list,
            initialPreset: initial,
            globalExclude: this.globalExclude(),
            skipEmptyDefault: settings.skipEmpty,
            adapters,
            noteExclude: overrides.noteExclude,
            notices,
            remember: (exclude) => rememberExclusions(this.app, file, exclude),
            saveAsPreset: async (input) => {
              const name = await promptForName(this.app, "Save as new preset", (n) =>
                presetNameProblem(n, this.store.presets),
              );
              if (name === null) return false;
              try {
                const created = await this.store.createPreset({ ...input, name });
                new Notice(`${PLUGIN_NAME}: saved preset "${name}" to ${created.path}.`);
                return true;
              } catch (err) {
                this.fail("could not save the preset", err);
                return false;
              }
            },
          },
          (choice) => void this.output(note, choice.job, choice.adapter, choice.preset),
        ).open();
        return;
      }

      const r = resolveDefaults({
        tree,
        globalExclude: this.globalExclude(),
        preset: initial.sections,
        noteExclude: overrides.noteExclude,
      });
      const job = buildJob({
        tree,
        included: finalSelection(r.defaults),
        title: note.title,
        includeTitle: initial.includeTitle,
        skipEmpty: initial.sections.skipEmpty ?? settings.skipEmpty,
        inlineMarkers: initial.inlineMarkers,
        excludeCalloutTypes: initial.callouts.excludeTypes,
        properties: {
          values: note.properties,
          mode: initial.properties.mode === "except" ? "choose" : initial.properties.mode,
          chosen: Object.keys(note.properties).filter(
            (k) => !initial.properties.list.some((x) => x.toLowerCase() === k.toLowerCase()),
          ),
        },
      });
      for (const message of [
        ...notices,
        ...[...r.warnings, ...job.warnings].map((w) => w.message),
      ]) {
        new Notice(`${PLUGIN_NAME}: ${message}`);
      }
      const adapter = adapters[0];
      if (!adapter) throw new Error("no output adapter is available");
      await this.output(note, job, adapter, initial);
    } catch (err) {
      this.fail("could not print", err);
    }
  }

  private async availableAdapters(): Promise<OutputAdapter[]> {
    const out: OutputAdapter[] = [];
    for (const a of this.adapters()) {
      const status = await a.isAvailable();
      if (status.ok) out.push(a);
      else this.log.debug(`adapter ${a.id} unavailable: ${status.reason ?? "unknown"}`);
    }
    return out;
  }

  private async output(
    note: NoteSnapshot,
    job: PrintJob,
    adapter: OutputAdapter,
    preset: Preset,
  ): Promise<void> {
    let rendered: Awaited<ReturnType<typeof renderJob>> | null = null;
    try {
      rendered = await renderJob(this.app, job, note.file.path);
      if (rendered.timedOut) {
        new Notice(
          `${PLUGIN_NAME}: some content was still loading (for example Dataview or diagrams) and may be missing.`,
        );
      }
      const s = this.settings();
      const result = await adapter.run(
        {
          title: note.title,
          content: rendered.content,
          matchTheme: s.printStyle === "match-theme",
        },
        {
          paper: preset.output.paper ?? s.paper,
          orientation: preset.output.orientation ?? s.orientation,
          marginsIn: s.marginsIn,
        },
      );
      if (!result.ok) new Notice(`${PLUGIN_NAME}: ${result.message ?? `${adapter.label} failed.`}`);
    } catch (err) {
      this.fail("could not print", err);
    } finally {
      rendered?.dispose();
    }
  }

  private fail(what: string, err: unknown): void {
    this.log.error(what, err);
    new Notice(`${PLUGIN_NAME}: ${what}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
