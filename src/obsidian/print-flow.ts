import { App, Notice, TFile } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import { buildJob, type PrintJob } from "../core/job";
import { BUILTIN_PRESETS, DEFAULT_PRESET, type Preset } from "../core/presets";
import { parseSections } from "../core/sections";
import { finalSelection, resolveDefaults, validateRuleEntry } from "../core/selection";
import type { Logger } from "../logger";
import type { OutputAdapter } from "../output/adapter";
import type { SelectivePrintSettings } from "../settings";
import { ReviewModal } from "../ui/ReviewModal";
import { readNote, type NoteSnapshot } from "./note-source";
import { renderJob } from "./render";

/**
 * One invocation: read the note, compute defaults, optionally show the review dialog,
 * render, and hand off to the output adapter. Wiring only; decisions live in src/core.
 */
export class PrintFlow {
  constructor(
    private readonly app: App,
    private readonly settings: () => SelectivePrintSettings,
    private readonly adapters: () => OutputAdapter[],
    private readonly log: Logger,
  ) {}

  /** Valid global exclude entries (blank or invalid ones are skipped). */
  private globalExclude(): string[] {
    return this.settings().globalExclude.filter(
      (e) => e.trim() !== "" && validateRuleEntry(e) === null,
    );
  }

  /** M2: built-in presets only. M3 adds vault presets and matching. */
  private presets(): { list: Preset[]; initial: Preset } {
    return { list: [...BUILTIN_PRESETS], initial: DEFAULT_PRESET };
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
      const { list, initial } = this.presets();
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
          },
          (choice) => void this.output(note, choice.job, choice.adapter),
        ).open();
        return;
      }

      const r = resolveDefaults({
        tree,
        globalExclude: this.globalExclude(),
        preset: initial.sections,
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
          mode: initial.properties.mode === "none" ? "none" : "all",
          chosen: [],
        },
      });
      for (const w of [...r.warnings, ...job.warnings]) new Notice(`${PLUGIN_NAME}: ${w.message}`);
      const adapter = adapters[0];
      if (!adapter) throw new Error("no output adapter is available");
      await this.output(note, job, adapter);
    } catch (err) {
      this.fail(err);
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

  private async output(note: NoteSnapshot, job: PrintJob, adapter: OutputAdapter): Promise<void> {
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
        { paper: s.paper, orientation: s.orientation, marginsIn: s.marginsIn },
      );
      if (!result.ok) new Notice(`${PLUGIN_NAME}: ${result.message ?? `${adapter.label} failed.`}`);
    } catch (err) {
      this.fail(err);
    } finally {
      rendered?.dispose();
    }
  }

  private fail(err: unknown): void {
    this.log.error("print failed", err);
    new Notice(
      `${PLUGIN_NAME}: could not print: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
