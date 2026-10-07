import { App, Modal, Notice, Setting } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import {
  checkState,
  depths,
  invertSelection,
  selectAll,
  selectNone,
  sizeHint,
  toggleSection,
  visibleSections,
} from "../core/dialog-state";
import { buildJob, isControlProperty, type PrintJob, type PropertiesChoice } from "../core/job";
import { rememberList } from "../core/note-keys";
import type { NewPresetInput, Preset } from "../core/presets";
import { finalSelection, findMissingHeadings, resolveDefaults } from "../core/selection";
import type { CoreWarning, SectionDefault, SectionTree } from "../core/types";
import type { NoteSnapshot } from "../obsidian/note-source";
import type { OutputAdapter } from "../output/adapter";

export interface ReviewContext {
  note: NoteSnapshot;
  tree: SectionTree;
  /** Dropdown order (see orderForDropdown); `initialPreset` must be in it. */
  presets: Preset[];
  initialPreset: Preset;
  globalExclude: readonly string[];
  skipEmptyDefault: boolean;
  adapters: OutputAdapter[];
  /** The note's print-exclude list, or null when the note has none. */
  noteExclude: string[] | null;
  /** Messages to show in the warnings area (note keys, preset problems). */
  notices: string[];
  /** Write print-exclude to the note. Only called when the user clicks "Remember". */
  remember: (list: string[]) => Promise<void>;
  /** Create a preset file from the current choices. Resolves false when cancelled. */
  saveAsPreset: (input: Omit<NewPresetInput, "name">) => Promise<boolean>;
}

export interface ReviewChoice {
  job: PrintJob;
  adapter: OutputAdapter;
  preset: Preset;
}

/**
 * The review dialog (SPEC 3.1). Shows the section tree as a checklist with defaults from the
 * global list and the preset. Nothing is written to disk; choices apply to this invocation.
 * All selection logic lives in src/core (dialog-state, selection, job).
 */
export class ReviewModal extends Modal {
  private preset: Preset;
  private defaults: SectionDefault[] = [];
  private resolveWarnings: CoreWarning[] = [];
  private included = new Set<string>();
  private includeTitle = true;
  private propertiesMode: PropertiesChoice = "all";
  private chosenProperties = new Set<string>();
  private skipEmpty = true;
  private adapter: OutputAdapter;
  private submitted = false;

  private listEl!: HTMLElement;
  private warningsEl!: HTMLElement;
  private summaryEl!: HTMLElement;
  private chooserEl!: HTMLElement;
  private optionsEl: HTMLElement | null = null;
  private infoEl!: HTMLElement;
  private primaryButton!: HTMLButtonElement;
  private readonly depth: Map<string, number>;
  private readonly propertyNames: string[];

  constructor(
    app: App,
    private readonly ctx: ReviewContext,
    private readonly onSubmit: (choice: ReviewChoice) => void,
  ) {
    super(app);
    this.preset = ctx.initialPreset;
    const first = ctx.adapters[0];
    if (!first) throw new Error("no output adapter is available");
    this.adapter = first;
    this.depth = depths(ctx.tree);
    this.propertyNames = Object.keys(ctx.note.properties).filter((k) => !isControlProperty(k));
    this.chosenProperties = new Set(this.propertyNames);
    this.applyPreset();
  }

  /** Reset every choice to the selected preset's defaults. */
  private applyPreset(): void {
    const r = resolveDefaults({
      tree: this.ctx.tree,
      globalExclude: this.ctx.globalExclude,
      preset: this.preset.sections,
      noteExclude: this.ctx.noteExclude,
    });
    this.defaults = r.defaults;
    this.resolveWarnings = [
      ...r.warnings,
      ...(this.preset.builtin
        ? []
        : findMissingHeadings(this.ctx.tree, this.preset.sections.exclude)),
    ];
    this.included = finalSelection(this.defaults);
    this.includeTitle = this.preset.includeTitle;
    this.skipEmpty = this.preset.sections.skipEmpty ?? this.ctx.skipEmptyDefault;
    this.propertiesMode = this.preset.properties.mode === "none" ? "none" : "all";
    if (this.preset.properties.mode === "except") {
      const omit = new Set(this.preset.properties.list.map((k) => k.toLowerCase()));
      this.propertiesMode = "choose";
      this.chosenProperties = new Set(this.propertyNames.filter((k) => !omit.has(k.toLowerCase())));
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("selective-print-modal");
    this.setTitle(`Print / export: ${this.ctx.note.title}`);

    new Setting(contentEl).setName("Preset").addDropdown((dd) => {
      this.ctx.presets.forEach((p, i) => {
        dd.addOption(String(i), p.name);
      });
      dd.setValue(String(this.ctx.presets.indexOf(this.preset)));
      dd.onChange((v) => {
        const next = this.ctx.presets[Number(v)];
        if (!next) return;
        this.preset = next;
        this.applyPreset();
        this.renderOptions();
        this.refresh();
      });
    });
    new Setting(contentEl).setName("Output").addDropdown((dd) => {
      for (const a of this.ctx.adapters) dd.addOption(a.id, a.label);
      dd.setValue(this.adapter.id);
      dd.setDisabled(this.ctx.adapters.length < 2);
      dd.onChange((v) => {
        this.adapter = this.ctx.adapters.find((a) => a.id === v) ?? this.adapter;
        this.primaryButton.setText(this.adapter.action);
      });
    });

    this.infoEl = contentEl.createDiv({ cls: "selective-print-info" });
    this.renderInfo();
    this.warningsEl = contentEl.createDiv({ cls: "selective-print-warnings" });

    const actions = contentEl.createDiv({ cls: "selective-print-quick-actions" });
    const quick = (label: string, fn: () => Set<string>): void => {
      actions.createEl("button", { text: label }).addEventListener("click", () => {
        this.included = fn();
        this.refresh();
      });
    };
    quick("Select all", () => selectAll(this.ctx.tree));
    quick("Select none", () => selectNone());
    quick("Reset", () => finalSelection(this.defaults));
    quick("Invert", () => invertSelection(this.ctx.tree, this.included));

    this.listEl = contentEl.createDiv({ cls: "selective-print-sections" });
    this.listEl.setAttribute("role", "group");
    this.listEl.setAttribute("aria-label", "Sections to include");

    this.optionsEl = contentEl.createDiv({ cls: "selective-print-options" });
    this.renderOptions();

    this.summaryEl = contentEl.createDiv({ cls: "selective-print-summary" });

    const persist = contentEl.createDiv({ cls: "selective-print-persist" });
    const rememberBtn = persist.createEl("button", {
      text: "Remember for this note",
      cls: "mod-muted",
    });
    rememberBtn.title = "Save the unchecked sections to this note's print-exclude property";
    rememberBtn.addEventListener("click", () => void this.remember());
    const saveBtn = persist.createEl("button", { text: "Save as new preset…", cls: "mod-muted" });
    saveBtn.addEventListener("click", () => void this.saveAsPreset());

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    this.primaryButton = buttons.createEl("button", { text: this.adapter.action, cls: "mod-cta" });
    this.primaryButton.addEventListener("click", () => this.submit());

    // Enter confirms unless a button has focus (it handles Enter itself). Esc cancels (Modal default).
    this.scope.register([], "Enter", (evt) => {
      if (evt.target instanceof HTMLButtonElement || evt.target instanceof HTMLSelectElement)
        return true;
      this.submit();
      return false;
    });

    this.refresh();
    this.listEl.querySelector("input")?.focus();
  }

  private renderOptions(): void {
    const el = this.optionsEl;
    if (!el) return;
    el.empty();
    new Setting(el).setName("Include note title").addToggle((t) =>
      t.setValue(this.includeTitle).onChange((v) => {
        this.includeTitle = v;
        this.refresh();
      }),
    );
    new Setting(el)
      .setName("Include properties")
      .setDisabled(this.propertyNames.length === 0)
      .addDropdown((dd) => {
        dd.addOption("none", "None").addOption("all", "All").addOption("choose", "Choose…");
        dd.setValue(this.propertiesMode);
        dd.setDisabled(this.propertyNames.length === 0);
        dd.onChange((v) => {
          this.propertiesMode = v as PropertiesChoice;
          this.renderChooser();
          this.refresh();
        });
      });
    this.chooserEl = el.createDiv({ cls: "selective-print-property-chooser" });
    this.renderChooser();
    new Setting(el)
      .setName("Skip empty sections")
      .setDesc("Leave out sections with only placeholders, empty bullets or checkboxes.")
      .addToggle((t) =>
        t.setValue(this.skipEmpty).onChange((v) => {
          this.skipEmpty = v;
          this.refresh();
        }),
      );
  }

  private renderChooser(): void {
    this.chooserEl.empty();
    if (this.propertiesMode !== "choose") return;
    for (const name of this.propertyNames) {
      const label = this.chooserEl.createEl("label", { cls: "selective-print-chip" });
      const box = label.createEl("input", { type: "checkbox" });
      box.checked = this.chosenProperties.has(name);
      label.appendText(name);
      box.addEventListener("change", () => {
        if (box.checked) this.chosenProperties.add(name);
        else this.chosenProperties.delete(name);
        this.refresh();
      });
    }
  }

  private currentJob(): PrintJob {
    return buildJob({
      tree: this.ctx.tree,
      included: this.included,
      title: this.ctx.note.title,
      includeTitle: this.includeTitle,
      skipEmpty: this.skipEmpty,
      inlineMarkers: this.preset.inlineMarkers,
      excludeCalloutTypes: this.preset.callouts.excludeTypes,
      properties: {
        values: this.ctx.note.properties,
        mode: this.propertiesMode,
        chosen: [...this.chosenProperties],
      },
    });
  }

  /** Re-render the checklist, warnings and summary from the current state. */
  private refresh(focusId?: string): void {
    this.renderList(focusId);
    const job = this.currentJob();
    this.warningsEl.empty();
    for (const message of [
      ...this.ctx.notices,
      ...[...this.resolveWarnings, ...job.warnings].map((w) => w.message),
    ]) {
      this.warningsEl.createDiv({ cls: "selective-print-warning", text: message });
    }
    const { included, excluded, emptySkipped } = job.stats;
    this.summaryEl.setText(
      `${included} ${included === 1 ? "section" : "sections"} included, ${excluded} excluded, ${emptySkipped} empty skipped`,
    );
    const nothing = job.markdown.trim() === "" && job.title === null && job.properties.length === 0;
    this.primaryButton.disabled = nothing;
    this.primaryButton.title = nothing ? "Nothing to output: every section is excluded" : "";
  }

  private renderList(focusId?: string): void {
    this.listEl.empty();
    const defaultsById = new Map(this.defaults.map((d) => [d.id, d]));
    const sections = visibleSections(this.ctx.tree);
    if (sections.length === 0) {
      this.listEl.createDiv({
        cls: "selective-print-empty-note",
        text: "This note has no content.",
      });
    }
    for (const s of sections) {
      const row = this.listEl.createEl("label", { cls: "selective-print-row" });
      row.setCssProps({ "--selective-print-depth": String(this.depth.get(s.id) ?? 0) });
      if (s.isEmpty) row.addClass("is-empty");
      const box = row.createEl("input", { type: "checkbox" });
      box.dataset.sectionId = s.id;
      const state = checkState(s, this.included);
      box.checked = state === "checked";
      box.indeterminate = state === "mixed";
      box.addEventListener("change", () => {
        this.included = toggleSection(s, this.included);
        this.refresh(s.id);
      });
      row.createSpan({
        cls: "selective-print-row-title",
        text: s.level === 0 ? "(Preamble)" : s.plainTitle || "(untitled)",
      });
      const d = defaultsById.get(s.id);
      if (d?.excluded && d.source) {
        row.createSpan({
          cls: "selective-print-tag",
          text: d.source,
          attr: { title: `Excluded by default (${d.source})` },
        });
      }
      if (s.isEmpty) row.createSpan({ cls: "selective-print-tag is-empty", text: "empty" });
      row.createSpan({ cls: "selective-print-size", text: sizeHint(s) });
    }
    if (focusId) {
      this.listEl
        .querySelector<HTMLInputElement>(`input[data-section-id="${CSS.escape(focusId)}"]`)
        ?.focus();
    }
  }

  private submit(): void {
    if (this.submitted || this.primaryButton.disabled) return;
    this.submitted = true;
    const choice = { job: this.currentJob(), adapter: this.adapter, preset: this.preset };
    this.close();
    this.onSubmit(choice);
  }

  private renderInfo(): void {
    this.infoEl.empty();
    if (this.ctx.noteExclude === null) return;
    const list = this.ctx.noteExclude.length ? this.ctx.noteExclude.join(", ") : "nothing";
    this.infoEl.setText(
      `This note has remembered choices (print-exclude: ${list}). They replace the preset and global exclusions.`,
    );
  }

  private async remember(): Promise<void> {
    const plan = rememberList(this.ctx.tree, this.included);
    try {
      await this.ctx.remember(plan.list);
    } catch (err) {
      new Notice(
        `${PLUGIN_NAME}: could not update the note: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    this.ctx.noteExclude = plan.list;
    this.applyPreset();
    this.renderOptions();
    this.renderInfo();
    this.refresh();
    const what = plan.list.length ? plan.list.join(", ") : "nothing (everything included)";
    new Notice(`${PLUGIN_NAME}: remembered for this note. Excluded: ${what}.`);
    for (const w of plan.warnings) new Notice(`${PLUGIN_NAME}: ${w.message}`, 8000);
  }

  private async saveAsPreset(): Promise<void> {
    const plan = rememberList(this.ctx.tree, this.included);
    const omit = this.propertyNames.filter((k) => !this.chosenProperties.has(k));
    const saved = await this.ctx.saveAsPreset({
      description: `Saved from the print dialog for "${this.ctx.note.title}".`,
      exclude: plan.list,
      // The list is complete, so it replaces the global list rather than adding to it.
      inheritGlobal: false,
      skipEmpty: this.skipEmpty,
      includeTitle: this.includeTitle,
      properties:
        this.propertiesMode === "choose"
          ? { mode: "except", list: omit }
          : { mode: this.propertiesMode, list: [] },
      excludeCalloutTypes: this.preset.callouts.excludeTypes,
      inlineMarkers: this.preset.inlineMarkers,
    });
    if (saved) for (const w of plan.warnings) new Notice(`${PLUGIN_NAME}: ${w.message}`, 8000);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
