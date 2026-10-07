import { App, Notice, TFile } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import { renderFilename } from "../core/filename";
import { pageLabels } from "../core/header-footer";
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
import {
  checkAdapters,
  runWithFallback,
  type OutputAdapter,
  type OutputOptions,
} from "../output/adapter";
import type { SelectivePrintSettings } from "../settings";
import { promptForName } from "../ui/NamePromptModal";
import { ReviewModal } from "../ui/ReviewModal";
import { readNote, type NoteSnapshot } from "./note-source";
import { rememberExclusions } from "./note-writes";
import { renderJob } from "./render";
import { vaultFolderPath, type PresetStore } from "./vault-presets";

export type OutputId = "print" | "pdf";

/**
 * One invocation: read the note, compute defaults, optionally show the review dialog,
 * render, and hand off to the output adapter. Wiring only; decisions live in src/core.
 */
export class PrintFlow {
  constructor(
    private readonly app: App,
    private readonly settings: () => SelectivePrintSettings,
    private readonly adapters: () => OutputAdapter[],
    /** The Print adapter: the fallback for every other adapter. */
    private readonly fallback: () => OutputAdapter,
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

  /** Pick the adapter: requested id, else the preset's format, else the setting; Print if unavailable. */
  private async chooseAdapter(
    preset: Preset,
    requested: OutputId | undefined,
  ): Promise<{ adapter: OutputAdapter; available: OutputAdapter[] }> {
    const { available, unavailable } = await checkAdapters(this.adapters());
    for (const u of unavailable) this.log.debug(`adapter ${u.adapter.id} unavailable: ${u.reason}`);
    const wanted = requested ?? preset.output.format ?? this.settings().defaultOutput;
    const hit = available.find((a) => a.id === wanted);
    if (hit) return { adapter: hit, available };
    const missing = unavailable.find((u) => u.adapter.id === wanted);
    if (missing) {
      new Notice(
        `${PLUGIN_NAME}: one-click ${missing.adapter.label} is not available (${missing.reason}). ` +
          `Use PDF → Save as PDF in the print dialog instead.`,
        8000,
      );
    }
    const adapter = available.find((a) => a.id === "print") ?? available[0];
    if (!adapter) throw new Error("no output adapter is available");
    return { adapter, available };
  }

  async start(file: TFile, opts: { dialog: boolean; output?: OutputId }): Promise<void> {
    try {
      if (file.extension !== "md") {
        new Notice(`${PLUGIN_NAME}: only Markdown notes can be printed.`);
        return;
      }
      const started = performance.now();
      const note = await readNote(this.app, file);
      const tree = parseSections(note.source);
      this.log.debug(
        `parsed "${file.path}": ${tree.lines.length} lines, ${tree.all.length} sections in ${Math.round(performance.now() - started)} ms`,
      );
      const overrides = readNoteOverrides(note.properties);
      const { list, initial, notices } = this.presetsFor(note);
      notices.push(...overrides.warnings.map((w) => w.message));
      const settings = this.settings();
      const { adapter: initialAdapter, available } = await this.chooseAdapter(initial, opts.output);

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
            adapters: available,
            initialAdapter,
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
      await this.output(note, job, initialAdapter, initial);
    } catch (err) {
      this.fail("could not print", err);
    }
  }

  private async output(
    note: NoteSnapshot,
    job: PrintJob,
    adapter: OutputAdapter,
    preset: Preset,
  ): Promise<void> {
    let rendered: Awaited<ReturnType<typeof renderJob>> | null = null;
    try {
      const started = performance.now();
      rendered = await renderJob(this.app, job, note.file.path);
      this.log.debug(
        `rendered ${job.markdown.length} characters in ${Math.round(performance.now() - started)} ms` +
          (rendered.timedOut ? " (settle timeout reached)" : ""),
      );
      if (rendered.timedOut) {
        new Notice(
          `${PLUGIN_NAME}: some content was still loading (for example Dataview or diagrams) and may be missing.`,
        );
      }
      const s = this.settings();
      const options: OutputOptions = {
        paper: preset.output.paper ?? s.paper,
        orientation: preset.output.orientation ?? s.orientation,
        marginsIn: s.marginsIn,
      };
      if (s.headerFooter) {
        options.labels = pageLabels({
          path: note.file.path,
          printedAt: new Date(),
          modifiedAt: new Date(note.file.stat.mtime),
        });
      }
      let primary = adapter;
      if (adapter.id === "pdf") {
        try {
          options.target = this.pdfTarget(note, preset);
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
        {
          title: note.title,
          content: rendered.content,
          matchTheme: s.printStyle === "match-theme",
        },
        options,
        (message) => new Notice(`${PLUGIN_NAME}: ${message}`, 10000),
      );
      if (result.cancelled) return;
      if (!result.ok) new Notice(`${PLUGIN_NAME}: ${result.message ?? `${adapter.label} failed.`}`);
      else if (result.path)
        new Notice(`${PLUGIN_NAME}: ${result.message ?? `saved ${result.path}`}`);
    } catch (err) {
      this.fail("could not print", err);
    } finally {
      rendered?.dispose();
    }
  }

  /**
   * Where the PDF goes and what it is called. A preset's `pdf-folder` means a vault folder;
   * otherwise the "Save PDFs to" setting decides (Save panel, Desktop, or vault).
   */
  private pdfTarget(note: NoteSnapshot, preset: Preset): NonNullable<OutputOptions["target"]> {
    const s = this.settings();
    const { name, warnings } = renderFilename(preset.output.filename ?? s.filenameTemplate, {
      title: note.title,
      preset: preset.name,
      properties: note.properties,
      now: new Date(),
    });
    for (const w of warnings) new Notice(`${PLUGIN_NAME}: file name: ${w.message}`);
    const openAfter = s.openPdfInPreview;

    const presetFolder = preset.output.pdfFolder;
    if (presetFolder === undefined && s.pdfDestination !== "vault") {
      return { kind: s.pdfDestination, name, openAfter };
    }
    const folderSetting = presetFolder ?? s.pdfFolder;
    let folder: string;
    if (folderSetting.trim() === "") {
      const parent = note.file.parent?.path ?? "";
      folder = parent === "/" ? "" : parent;
    } else {
      const resolved = vaultFolderPath(folderSetting);
      if (resolved === null)
        throw new Error(`the PDF folder "${folderSetting}" points outside the vault`);
      folder = resolved;
    }
    return { kind: "vault", folder, name, openAfter };
  }

  private fail(what: string, err: unknown): void {
    this.log.error(what, err);
    new Notice(`${PLUGIN_NAME}: ${what}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
