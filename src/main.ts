import { MarkdownView, Notice, Platform, Plugin, TFile, TFolder } from "obsidian";
import { PLUGIN_NAME } from "./constants";
import { createLogger, type Logger } from "./logger";
import { buildDiagnostics, DiagnosticsModal } from "./obsidian/diagnostics";
import { PackFlow } from "./obsidian/pack-flow";
import { PrintFlow, type OutputId } from "./obsidian/print-flow";
import { HeaderActions } from "./obsidian/triggers";
import { describeStarterSync, noticeError, PresetStore } from "./obsidian/vault-presets";
import type { OutputAdapter } from "./output/adapter";
import printCss from "../print.css";
import {
  askSavePath,
  desktopDir,
  localFileExists,
  openPathExternally,
  pdfCapability,
  renderHtmlFileToPdf,
  writeLocalFile,
} from "./output/electron-bridge";
import { PdfAdapter } from "./output/pdf";
import { PrintAdapter } from "./output/print";
import { VaultPdfIo } from "./obsidian/pdf-io";
import { migrateSettings, type SelectivePrintSettings } from "./settings";
import { FolderPickerModal } from "./ui/FolderPickerModal";
import { promptForText } from "./ui/NamePromptModal";
import { PresetPickerModal } from "./ui/PresetPickerModal";
import { parsePackQuery } from "./core/pack";
import { SettingsTab } from "./ui/SettingsTab";
import { ValidationModal } from "./ui/ValidationModal";

/** Plugin entry: wiring only. Business logic lives in src/core (CLAUDE.md section 3.6). */
export default class SelectivePrintPlugin extends Plugin {
  declare settings: SelectivePrintSettings;
  private log!: Logger;
  private readonly pendingCleanups = new Set<() => void>();
  private adapters: OutputAdapter[] = [];
  private flow!: PrintFlow;
  private packs!: PackFlow;
  store!: PresetStore;
  private header: HeaderActions | null = null;
  private ribbon: HTMLElement | null = null;

  async onload(): Promise<void> {
    this.settings = migrateSettings(await this.loadData());
    this.log = createLogger(() => this.settings.debugLogging);

    if (!Platform.isDesktopApp || !Platform.isMacOS) {
      new Notice(`${PLUGIN_NAME} supports Obsidian desktop on macOS only. The plugin is inactive.`);
      return;
    }

    const printAdapter = new PrintAdapter(this.log, this.pendingCleanups);
    const pdfIo = new VaultPdfIo(
      this.app,
      this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`,
    );
    const pdfAdapter = new PdfAdapter(
      {
        capability: pdfCapability,
        render: renderHtmlFileToPdf,
        open: openPathExternally,
        desktopDir,
        askSavePath,
        localExists: localFileExists,
        writeLocal: writeLocalFile,
      },
      pdfIo,
      printCss,
    );
    this.adapters = [printAdapter, pdfAdapter];
    this.store = new PresetStore(this.app, () => this.settings.presetsFolder, this.log);
    this.store.watch(this);
    this.flow = new PrintFlow(
      this.app,
      () => this.settings,
      () => this.adapters,
      () => printAdapter,
      this.store,
      this.log,
    );
    this.packs = new PackFlow(
      this.app,
      () => this.settings,
      () => this.adapters,
      () => printAdapter,
      this.store,
      this.log,
    );

    this.addSettingTab(new SettingsTab(this.app, this));

    this.addCommand({
      id: "print-current-note",
      name: "Print / export current note…",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.print(file, true)),
    });
    this.addCommand({
      id: "save-current-note-as-pdf",
      name: "Save current note as PDF",
      checkCallback: (checking) =>
        this.withActiveNote(checking, (file) =>
          this.print(file, this.settings.alwaysReview, "pdf"),
        ),
    });
    this.addCommand({
      id: "quick-print-current-note",
      name: "Quick print current note (preset defaults)",
      checkCallback: (checking) =>
        this.withActiveNote(checking, (file) => this.print(file, false, "print")),
    });
    this.addCommand({
      id: "print-folder",
      name: "Print a folder…",
      callback: () =>
        new FolderPickerModal(this.app, (folder) => void this.packs.startFolder(folder)).open(),
    });
    this.addCommand({
      id: "print-notes-by-query",
      name: "Print notes by tag or property…",
      callback: async () => {
        const query = await promptForText(this.app, {
          title: "Print notes by tag or property",
          label: "Tag or property",
          action: "Find notes",
          placeholder: "#meeting or type: meeting",
          validate: (text) => {
            const q = parsePackQuery(text);
            return q.ok ? null : q.error;
          },
        });
        if (query !== null) await this.packs.startQuery(query);
      },
    });
    this.addCommand({
      id: "validate-presets",
      name: "Validate print presets",
      callback: () => void this.showValidation(),
    });
    this.addCommand({
      id: "open-preset",
      name: "Open print preset…",
      callback: () => {
        const files = this.store.files();
        if (files.length === 0)
          new Notice(`${PLUGIN_NAME}: no preset files in "${this.settings.presetsFolder}".`);
        else new PresetPickerModal(this.app, files).open();
      },
    });
    this.addCommand({
      id: "install-starter-presets",
      name: "Install / refresh starter presets",
      callback: () => void this.syncStarters("manual"),
    });
    this.addCommand({
      id: "show-diagnostics",
      name: "Show diagnostics",
      callback: () => void this.showDiagnostics(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) =>
            item
              .setTitle("Print folder…")
              .setIcon("printer")
              .onClick(() => void this.packs.startFolder(file)),
          );
          return;
        }
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Print / export…")
            .setIcon("printer")
            .onClick(() => this.print(file, true)),
        );
      }),
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const notes: TFile[] = [];
        for (const f of files) {
          if (f instanceof TFile && f.extension === "md") notes.push(f);
          else if (f instanceof TFolder) notes.push(...this.packs.notesInFolder(f, false));
        }
        if (notes.length === 0) return;
        menu.addItem((item) =>
          item
            .setTitle("Print selected notes…")
            .setIcon("printer")
            .onClick(() => void this.packs.startFiles(notes)),
        );
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, info) => {
        const file = info.file;
        if (!file) return;
        menu.addItem((item) =>
          item
            .setTitle("Print / export…")
            .setIcon("printer")
            .onClick(() => this.print(file, true)),
        );
      }),
    );

    this.header = new HeaderActions(
      this,
      () => this.settings.showHeaderIcon,
      (view: MarkdownView, evt: MouseEvent) => {
        if (view.file) this.print(view.file, this.settings.alwaysReview && !evt.shiftKey);
      },
    );
    this.app.workspace.onLayoutReady(() => {
      this.header?.refresh();
      void this.store.reload().then(() => this.syncStarters("auto"));
      void pdfIo.removeStaleTemp();
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.header?.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.header?.refresh()));
    this.updateRibbon();

    this.log.debug("loaded");
  }

  onunload(): void {
    this.header?.removeAll();
    this.ribbon?.remove();
    for (const cleanup of Array.from(this.pendingCleanups)) cleanup();
    this.pendingCleanups.clear();
  }

  async saveSettings(): Promise<void> {
    // Blank rows exist only while being edited in the settings tab; never persist them.
    const persisted = {
      ...this.settings,
      globalExclude: this.settings.globalExclude.filter((e) => e.trim() !== ""),
    };
    await this.saveData(persisted);
    this.header?.refresh();
    this.updateRibbon();
  }

  async showValidation(): Promise<void> {
    await this.store.reload();
    const folder = this.store.folder();
    if (folder === null) {
      new Notice(`${PLUGIN_NAME}: the presets folder setting points outside the vault.`);
      return;
    }
    new ValidationModal(this.app, folder, this.store.report).open();
  }

  /** "auto" runs on every load: installs new starters and upgrades unmodified ones. */
  async syncStarters(mode: "auto" | "manual"): Promise<void> {
    try {
      const { actions, installed } = await this.store.syncStarters(
        this.settings.installedStarters,
        mode,
      );
      this.settings.installedStarters = installed;
      await this.saveSettings();
      const wrote = actions.some((a) => a.kind !== "skip");
      if (mode === "manual" || wrote) new Notice(describeStarterSync(actions));
      if (wrote) await this.store.reload();
    } catch (err) {
      noticeError("could not install starter presets", err);
    }
  }

  private print(file: TFile, dialog: boolean, output?: OutputId): void {
    void this.flow.start(file, output ? { dialog, output } : { dialog });
  }

  private withActiveNote(checking: boolean, run: (file: TFile) => void): boolean {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (!file) return false;
    if (!checking) run(file);
    return true;
  }

  private updateRibbon(): void {
    if (this.settings.showRibbonIcon && !this.ribbon) {
      this.ribbon = this.addRibbonIcon("printer", "Print / export current note", () => {
        const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
        if (file) this.print(file, this.settings.alwaysReview);
        else new Notice(`${PLUGIN_NAME}: open a note to print it.`);
      });
    } else if (!this.settings.showRibbonIcon && this.ribbon) {
      this.ribbon.remove();
      this.ribbon = null;
    }
  }

  /** Diagnostics report text; null (with a notice) when it cannot be built. */
  async diagnosticsText(): Promise<string | null> {
    try {
      return await buildDiagnostics(
        this.manifest.version,
        this.settings,
        this.adapters,
        this.store,
      );
    } catch (err) {
      this.log.error("diagnostics failed", err);
      new Notice(
        `${PLUGIN_NAME}: diagnostics failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async showDiagnostics(): Promise<void> {
    const text = await this.diagnosticsText();
    if (text !== null) new DiagnosticsModal(this.app, text).open();
  }
}
