import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_GLOBAL_EXCLUDE } from "../constants";
import { DEFAULT_DIGEST_SECTIONS, parseDigestList } from "../core/digest";
import { validateRuleEntry } from "../core/selection";
import { copyDiagnostics } from "../obsidian/diagnostics";
import { vaultFolderPath } from "../obsidian/vault-presets";
import { renderFilename } from "../core/filename";
import type { OutputFormat, Orientation, PaperSize, PdfDestination, PrintStyle } from "../settings";
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
          const ok = vaultFolderPath(v) !== null;
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
      .setName("Default output")
      .setDesc(
        "Used by the header icon and preselected in the dialog. A preset's output format overrides it.",
      )
      .addDropdown((dd) =>
        dd
          .addOption("print", "Print")
          .addOption("pdf", "PDF (one click)")
          .setValue(s.defaultOutput === "pdf" ? "pdf" : "print")
          .onChange(async (v) => {
            s.defaultOutput = v as OutputFormat;
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName("Save PDF files to")
      .setDesc(
        "Where one-click PDF files go. A preset with its own PDF folder always saves into the vault.",
      )
      .addDropdown((dd) =>
        dd
          .addOption("ask", "Ask where to save (starts on your desktop)")
          .addOption("desktop", "Desktop")
          .addOption("vault", "The vault")
          .setValue(s.pdfDestination)
          .onChange(async (v) => {
            s.pdfDestination = v as PdfDestination;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    const pdfFolder = new Setting(containerEl)
      .setName("PDF folder in the vault")
      .setDesc("Vault folder where PDF files are saved. Leave empty to save next to the note.")
      .addText((t) =>
        t
          .setPlaceholder("Next to the note")
          .setValue(s.pdfFolder)
          .onChange(async (v) => {
            const ok = v.trim() === "" || vaultFolderPath(v) !== null;
            pdfFolder.descEl.setText(
              ok
                ? "Vault folder where PDF files are saved. Leave empty to save next to the note."
                : "Must be a folder inside the vault.",
            );
            pdfFolder.descEl.toggleClass("selective-print-error", !ok);
            if (!ok) return;
            s.pdfFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );
    if (s.pdfDestination !== "vault") pdfFolder.settingEl.hide();
    const example = (template: string): string =>
      renderFilename(template, {
        title: "Weekly Sync",
        preset: "Meeting notes",
        properties: { date: "2026-10-07" },
        now: new Date(),
      }).name + ".pdf";
    const filename = new Setting(containerEl)
      .setName("PDF file name")
      .setDesc(
        `Variables: {title} {date} {datetime} {preset} {frontmatter.<key>}. Example: ${example(s.filenameTemplate)}`,
      )
      .addText((t) =>
        t.setValue(s.filenameTemplate).onChange(async (v) => {
          s.filenameTemplate = v.trim() === "" ? "{title}" : v;
          filename.setDesc(
            `Variables: {title} {date} {datetime} {preset} {frontmatter.<key>}. Example: ${example(s.filenameTemplate)}`,
          );
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Open PDF after saving")
      .setDesc("Opens the saved file in your default PDF app.")
      .addToggle((t) =>
        t.setValue(s.openPdfInPreview).onChange(async (v) => {
          s.openPdfInPreview = v;
          await this.plugin.saveSettings();
        }),
      );
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
    new Setting(containerEl)
      .setName("Margins (inches)")
      .setDesc("0.4 to 3. The header and footer print inside the margin.")
      .addText((t) =>
        t.setValue(String(s.marginsIn)).onChange(async (v) => {
          const n = Number(v);
          // The header and footer sit in the margin; below 0.4 in they would be clipped.
          if (!Number.isFinite(n) || n < 0.4 || n > 3) return;
          s.marginsIn = n;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Header and footer")
      .setDesc(
        "Header: the note's folder and name, and when it was last modified. Footer: when it was printed, and the page number.",
      )
      .addToggle((t) =>
        t.setValue(s.headerFooter).onChange(async (v) => {
          s.headerFooter = v;
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

    new Setting(containerEl).setName("Packs").setHeading();
    const digest = new Setting(containerEl)
      .setName("Digest sections")
      .setDesc(
        "Sections a digest pack keeps, one heading per line. Excluded sections stay excluded.",
      )
      .addTextArea((t) => {
        t.setValue(s.digestSections.join("\n")).onChange(async (v) => {
          const entries = parseDigestList(v);
          const bad = entries.map((e) => validateRuleEntry(e)).find((p) => p !== null);
          digest.descEl.setText(
            bad ??
              "Sections a digest pack keeps, one heading per line. Excluded sections stay excluded.",
          );
          digest.descEl.toggleClass("selective-print-error", bad !== undefined);
          if (bad) return;
          s.digestSections = entries;
          await this.plugin.saveSettings();
        });
        t.inputEl.rows = 3;
      })
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip("Reset to the default list")
          .onClick(async () => {
            s.digestSections = [...DEFAULT_DIGEST_SECTIONS];
            await this.plugin.saveSettings();
            this.display();
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
      .setName("Diagnostics")
      .setDesc(
        "Versions, capabilities, presets and settings for a bug report. Contains no note content.",
      )
      .addButton((b) =>
        b.setButtonText("Copy diagnostics").onClick(async () => {
          const text = await this.plugin.diagnosticsText();
          if (text !== null) await copyDiagnostics(text);
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
