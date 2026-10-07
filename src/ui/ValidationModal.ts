import { App, Modal } from "obsidian";
import type { PresetIssue, PresetSetResult } from "../core/presets";

/** "Validate print presets" report: file, field and message for every problem. */
export class ValidationModal extends Modal {
  constructor(
    app: App,
    private readonly folder: string,
    private readonly result: PresetSetResult,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, result } = this;
    this.setTitle("Print preset validation");
    contentEl.addClass("selective-print-validation");
    contentEl.createEl("p", {
      text:
        `Folder "${this.folder || "/"}": ${result.presets.length} valid ${result.presets.length === 1 ? "preset" : "presets"}, ` +
        `${result.errors.length} ${result.errors.length === 1 ? "error" : "errors"}, ` +
        `${result.warnings.length} ${result.warnings.length === 1 ? "warning" : "warnings"}.`,
    });
    this.section("Errors (these presets are skipped)", result.errors);
    this.section("Warnings (these presets still load)", result.warnings);
    if (result.presets.length) {
      contentEl.createEl("h4", { text: "Valid presets" });
      const ul = contentEl.createEl("ul");
      for (const p of result.presets) ul.createEl("li", { text: `${p.name} (${p.file ?? ""})` });
    }
  }

  private section(title: string, issues: readonly PresetIssue[]): void {
    if (issues.length === 0) return;
    this.contentEl.createEl("h4", { text: title });
    const ul = this.contentEl.createEl("ul");
    for (const i of issues) ul.createEl("li", { text: `${i.file}: ${i.field}: ${i.message}` });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
