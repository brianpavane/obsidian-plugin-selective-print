import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_GLOBAL_EXCLUDE } from "../constants";
import { validateRuleEntry } from "../core/selection";
import { presetsFolderPath } from "../obsidian/vault-presets";
import type { Orientation, PaperSize, PrintStyle } from "../settings";
import type SelectivePrintPlugin from "../main";

/** Settings tab. Shows only settings whose feature has shipped (M2). */
export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: SelectivePrintPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Always review before output")
      .setDesc(
        "Open the review dialog on every print. Shift-click the header icon to skip it once.",
      )
      .addToggle((t) =>
        t.setValue(s.alwaysReview).onChange(async (v) => {
          s.alwaysReview = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Global exclude list").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Headings excluded by default from every note, at any level (case-insensitive). " +
        "Subheadings go with them. Excluded sections still appear in the review dialog, unchecked. " +
        "Prefix with regex: for a regular expression.",
    });
    const listEl = containerEl.createDiv({ cls: "selective-print-exclude-list" });
    this.renderExcludeList(listEl);
    new Setting(containerEl)
      .addButton((b) =>
        b.setButtonText("Add heading").onClick(() => {
          s.globalExclude.push("");
          this.renderExcludeList(listEl, s.globalExclude.length - 1);
        }),
      )
      .addButton((b) =>
        b.setButtonText("Reset to default").onClick(async () => {
          s.globalExclude = [...DEFAULT_GLOBAL_EXCLUDE];
          await this.plugin.saveSettings();
          this.renderExcludeList(listEl);
        }),
      );

    new Setting(containerEl).setName("Presets").setHeading();
    const report = this.plugin.store.report;
    const folderSetting = new Setting(containerEl)
      .setName("Presets folder")
      .setDesc("Vault folder that holds preset notes.")
      .addText((t) =>
        t.setValue(s.presetsFolder).onChange(async (v) => {
          const ok = presetsFolderPath(v) !== null;
          folderSetting.descEl.setText(
            ok ? "Vault folder that holds preset notes." : "Must be a folder inside the vault.",
          );
          folderSetting.descEl.toggleClass("selective-print-error", !ok);
          if (!ok) return;
          s.presetsFolder = v.trim();
          await this.plugin.saveSettings();
          await this.plugin.store.reload();
        }),
      );
    new Setting(containerEl)
      .setName("Starter presets")
      .setDesc(
        "Install missing starters and update the ones you have not edited. Edited starters are never overwritten.",
      )
      .addButton((b) =>
        b.setButtonText("Install / refresh").onClick(async () => {
          await this.plugin.syncStarters("manual");
          this.display();
        }),
      );
    new Setting(containerEl)
      .setName("Validate presets")
      .setDesc(
        `${report.presets.length} valid, ${report.errors.length} ${report.errors.length === 1 ? "error" : "errors"}, ` +
          `${report.warnings.length} ${report.warnings.length === 1 ? "warning" : "warnings"}.`,
      )
      .addButton((b) =>
        b.setButtonText("Show report").onClick(() => void this.plugin.showValidation()),
      );

    new Setting(containerEl).setName("Output").setHeading();
    new Setting(containerEl)
      .setName("Skip empty sections")
      .setDesc("Default for the dialog: leave out sections with only placeholders.")
      .addToggle((t) =>
        t.setValue(s.skipEmpty).onChange(async (v) => {
          s.skipEmpty = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl).setName("Paper size").addDropdown((dd) =>
      dd
        .addOption("letter", "Letter")
        .addOption("a4", "A4")
        .setValue(s.paper)
        .onChange(async (v) => {
          s.paper = v as PaperSize;
          await this.plugin.saveSettings();
        }),
    );
    new Setting(containerEl).setName("Orientation").addDropdown((dd) =>
      dd
        .addOption("portrait", "Portrait")
        .addOption("landscape", "Landscape")
        .setValue(s.orientation)
        .onChange(async (v) => {
          s.orientation = v as Orientation;
          await this.plugin.saveSettings();
        }),
    );
    new Setting(containerEl).setName("Margins (inches)").addText((t) =>
      t.setValue(String(s.marginsIn)).onChange(async (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 3) return;
        s.marginsIn = n;
        await this.plugin.saveSettings();
      }),
    );
    new Setting(containerEl)
      .setName("Print style")
      .setDesc(
        "Neutral prints black on white whatever your theme. Match theme (experimental) copies your current theme.",
      )
      .addDropdown((dd) =>
        dd
          .addOption("neutral", "Neutral")
          .addOption("match-theme", "Match theme (experimental)")
          .setValue(s.printStyle)
          .onChange(async (v) => {
            s.printStyle = v as PrintStyle;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName("Interface").setHeading();
    new Setting(containerEl).setName("Show header icon").addToggle((t) =>
      t.setValue(s.showHeaderIcon).onChange(async (v) => {
        s.showHeaderIcon = v;
        await this.plugin.saveSettings();
      }),
    );
    new Setting(containerEl).setName("Show ribbon icon").addToggle((t) =>
      t.setValue(s.showRibbonIcon).onChange(async (v) => {
        s.showRibbonIcon = v;
        await this.plugin.saveSettings();
      }),
    );
    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc("Write detailed logs to the developer console.")
      .addToggle((t) =>
        t.setValue(s.debugLogging).onChange(async (v) => {
          s.debugLogging = v;
          await this.plugin.saveSettings();
        }),
      );
  }

  /** One row per entry. Invalid or blank entries are shown with an error and not saved. */
  private renderExcludeList(listEl: HTMLElement, focusIndex?: number): void {
    const s = this.plugin.settings;
    listEl.empty();
    if (s.globalExclude.length === 0) {
      listEl.createEl("p", {
        cls: "setting-item-description",
        text: "Empty: every section is included by default.",
      });
    }
    s.globalExclude.forEach((entry, i) => {
      const row = new Setting(listEl).addText((t) => {
        t.setPlaceholder("Heading name").setValue(entry);
        t.onChange(async (v) => {
          const problem = v.trim() === "" ? null : validateRuleEntry(v);
          row.setDesc(problem ?? "");
          row.descEl.toggleClass("selective-print-error", problem !== null);
          if (problem) return;
          s.globalExclude[i] = v.trim();
          await this.plugin.saveSettings();
        });
        if (i === focusIndex) window.setTimeout(() => t.inputEl.focus(), 0);
      });
      row.addExtraButton((b) =>
        b
          .setIcon("trash")
          .setTooltip("Remove")
          .onClick(async () => {
            s.globalExclude.splice(i, 1);
            await this.plugin.saveSettings();
            this.renderExcludeList(listEl);
          }),
      );
    });
  }
}
