import { App, Modal, Setting } from "obsidian";
import {
  filterPackByDate,
  moveItem,
  noteDate,
  sortPackNotes,
  type PackNote,
  type PackSort,
} from "../core/pack";
import type { Preset } from "../core/presets";
import { BUILTIN_PRESETS } from "../core/presets";
import type { OutputAdapter } from "../output/adapter";

export interface PackContext {
  title: string;
  notes: PackNote[];
  /** Re-collect the notes with or without subfolders (folder packs only). */
  collect: ((recursive: boolean) => PackNote[]) | null;
  presets: Preset[];
  adapters: OutputAdapter[];
  initialAdapter: OutputAdapter;
}

export interface PackChoice {
  title: string;
  /** Selected notes in print order. */
  notes: PackNote[];
  /** One preset for every note, or null for each note's own defaults. */
  preset: Preset | null;
  cover: boolean;
  contents: boolean;
  newPage: boolean;
  adapter: OutputAdapter;
}

/**
 * The pack dialog: which notes, in which order, and how the document is assembled. Sections
 * inside each note follow that note's own defaults (or one chosen preset); there is no
 * per-note checklist. Ordering and filtering logic lives in src/core/pack.ts.
 */
export class PackModal extends Modal {
  private all: PackNote[];
  private order: PackNote[];
  private unchecked = new Set<string>();
  private sort: PackSort = "date";
  private from: string | null = null;
  private to: string | null = null;
  private recursive = false;
  private preset: Preset | null = null;
  private cover = true;
  private contents = true;
  private newPage = true;
  private adapter: OutputAdapter;
  private submitted = false;

  private listEl!: HTMLElement;
  private summaryEl!: HTMLElement;
  private primary!: HTMLButtonElement;

  constructor(
    app: App,
    private readonly ctx: PackContext,
    private readonly onSubmit: (choice: PackChoice) => void,
  ) {
    super(app);
    this.all = ctx.notes;
    this.order = sortPackNotes(this.all, this.sort);
    this.adapter = ctx.initialAdapter;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("selective-print-modal");
    this.setTitle(`Print pack: ${this.ctx.title}`);

    if (this.ctx.collect) {
      const collect = this.ctx.collect;
      new Setting(contentEl).setName("Include subfolders").addToggle((t) =>
        t.setValue(this.recursive).onChange((v) => {
          this.recursive = v;
          this.all = collect(v);
          this.order = sortPackNotes(this.all, this.sort);
          this.refresh();
        }),
      );
    }
    new Setting(contentEl).setName("Order").addDropdown((dd) =>
      dd
        .addOption("date", "By date, then name")
        .addOption("name", "By name")
        .addOption("modified", "By last modified")
        .setValue(this.sort)
        .onChange((v) => {
          this.sort = v as PackSort;
          this.order = sortPackNotes(this.all, this.sort);
          this.refresh();
        }),
    );
    const range = new Setting(contentEl)
      .setName("Date range")
      .setDesc("Optional. Uses the date property, or a date in the file name.");
    const dateInput = (label: string, set: (v: string | null) => void): void => {
      const input = range.controlEl.createEl("input", {
        type: "date",
        attr: { "aria-label": label },
      });
      input.addEventListener("change", () => {
        set(input.value || null);
        this.refresh();
      });
    };
    dateInput("From", (v) => (this.from = v));
    range.controlEl.createSpan({ text: "to" });
    dateInput("To", (v) => (this.to = v));

    new Setting(contentEl)
      .setName("Sections")
      .setDesc("Each note uses its own preset and exclusions, or one preset for all.")
      .addDropdown((dd) => {
        const all = [...this.ctx.presets, ...BUILTIN_PRESETS];
        dd.addOption("", "Each note's own defaults");
        all.forEach((p, i) => {
          dd.addOption(String(i), p.name);
        });
        dd.onChange((v) => {
          this.preset = v === "" ? null : (all[Number(v)] ?? null);
        });
      });
    new Setting(contentEl)
      .setName("Cover page")
      .addToggle((t) => t.setValue(this.cover).onChange((v) => (this.cover = v)));
    new Setting(contentEl)
      .setName("Contents")
      .setDesc("Note titles in order; clickable in the PDF.")
      .addToggle((t) => t.setValue(this.contents).onChange((v) => (this.contents = v)));
    new Setting(contentEl)
      .setName("Each note on a new page")
      .addToggle((t) => t.setValue(this.newPage).onChange((v) => (this.newPage = v)));
    new Setting(contentEl).setName("Output").addDropdown((dd) => {
      for (const a of this.ctx.adapters) dd.addOption(a.id, a.label);
      dd.setValue(this.adapter.id);
      dd.setDisabled(this.ctx.adapters.length < 2);
      dd.onChange((v) => {
        this.adapter = this.ctx.adapters.find((a) => a.id === v) ?? this.adapter;
        this.primary.setText(this.adapter.action);
      });
    });

    this.listEl = contentEl.createDiv({
      cls: "selective-print-sections selective-print-pack-list",
    });
    this.listEl.setAttribute("role", "group");
    this.listEl.setAttribute("aria-label", "Notes in the pack");
    this.summaryEl = contentEl.createDiv({ cls: "selective-print-summary" });

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    this.primary = buttons.createEl("button", { text: this.adapter.action, cls: "mod-cta" });
    this.primary.addEventListener("click", () => this.submit());

    this.refresh();
  }

  private visible(): { notes: PackNote[]; undated: number } {
    const r = filterPackByDate(this.order, this.from, this.to);
    return { notes: r.kept, undated: r.undated.length };
  }

  private refresh(focusPath?: string): void {
    const { notes, undated } = this.visible();
    this.listEl.empty();
    if (notes.length === 0) {
      this.listEl.createDiv({ cls: "selective-print-empty-note", text: "No notes match." });
    }
    notes.forEach((n, i) => {
      const row = this.listEl.createDiv({ cls: "selective-print-row" });
      const label = row.createEl("label", { cls: "selective-print-pack-label" });
      const box = label.createEl("input", { type: "checkbox" });
      box.dataset.path = n.path;
      box.checked = !this.unchecked.has(n.path);
      box.addEventListener("change", () => {
        if (box.checked) this.unchecked.delete(n.path);
        else this.unchecked.add(n.path);
        this.refresh(n.path);
      });
      label.createSpan({ cls: "selective-print-row-title", text: n.title });
      row.createSpan({ cls: "selective-print-size", text: noteDate(n) ?? "no date" });
      const move = (delta: number, text: string, aria: string): void => {
        const b = row.createEl("button", {
          text,
          cls: "clickable-icon",
          attr: { "aria-label": aria },
        });
        b.disabled = (delta < 0 && i === 0) || (delta > 0 && i === notes.length - 1);
        b.addEventListener("click", () => {
          const at = this.order.indexOf(n);
          const neighbor = notes[i + delta];
          const target = neighbor ? this.order.indexOf(neighbor) : at;
          this.order = moveItem(this.order, at, target - at);
          this.refresh(n.path);
        });
      };
      move(-1, "↑", `Move ${n.title} up`);
      move(1, "↓", `Move ${n.title} down`);
    });
    if (focusPath) {
      this.listEl
        .querySelector<HTMLInputElement>(`input[data-path="${CSS.escape(focusPath)}"]`)
        ?.focus();
    }
    const selected = notes.filter((n) => !this.unchecked.has(n.path)).length;
    this.summaryEl.setText(
      `${selected} of ${notes.length} ${notes.length === 1 ? "note" : "notes"} selected` +
        (undated ? `; ${undated} without a date left out by the date range` : ""),
    );
    this.primary.disabled = selected === 0;
  }

  private submit(): void {
    if (this.submitted || this.primary.disabled) return;
    this.submitted = true;
    const notes = this.visible().notes.filter((n) => !this.unchecked.has(n.path));
    this.close();
    this.onSubmit({
      title: this.ctx.title,
      notes,
      preset: this.preset,
      cover: this.cover,
      contents: this.contents,
      newPage: this.newPage,
      adapter: this.adapter,
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
