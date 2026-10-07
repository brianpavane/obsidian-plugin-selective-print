import { MarkdownView, Notice, Platform, Plugin, TFile } from "obsidian";
import { PLUGIN_NAME } from "./constants";
import { createLogger, type Logger } from "./logger";
import { buildDiagnostics, DiagnosticsModal } from "./obsidian/diagnostics";
import { PrintFlow } from "./obsidian/print-flow";
import { HeaderActions } from "./obsidian/triggers";
import type { OutputAdapter } from "./output/adapter";
import { PrintAdapter } from "./output/print";
import { migrateSettings, type SelectivePrintSettings } from "./settings";
import { SettingsTab } from "./ui/SettingsTab";

/** Plugin entry: wiring only. Business logic lives in src/core (CLAUDE.md section 3.6). */
export default class SelectivePrintPlugin extends Plugin {
  declare settings: SelectivePrintSettings;
  private log!: Logger;
  private readonly pendingCleanups = new Set<() => void>();
  private adapters: OutputAdapter[] = [];
  private flow!: PrintFlow;
  private header: HeaderActions | null = null;
  private ribbon: HTMLElement | null = null;

  async onload(): Promise<void> {
    this.settings = migrateSettings(await this.loadData());
    this.log = createLogger(() => this.settings.debugLogging);

    if (!Platform.isDesktopApp || !Platform.isMacOS) {
      new Notice(`${PLUGIN_NAME} supports Obsidian desktop on macOS only. The plugin is inactive.`);
      return;
    }

    this.adapters = [new PrintAdapter(this.log, this.pendingCleanups)];
    this.flow = new PrintFlow(
      this.app,
      () => this.settings,
      () => this.adapters,
      this.log,
    );

    this.addSettingTab(new SettingsTab(this.app, this));

    this.addCommand({
      id: "print-current-note",
      name: "Print / export current note…",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.print(file, true)),
    });
    this.addCommand({
      id: "quick-print-current-note",
      name: "Quick print current note (preset defaults)",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.print(file, false)),
    });
    this.addCommand({
      id: "show-diagnostics",
      name: "Show diagnostics",
      callback: () => void this.showDiagnostics(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
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
    this.app.workspace.onLayoutReady(() => this.header?.refresh());
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

  private print(file: TFile, dialog: boolean): void {
    void this.flow.start(file, { dialog });
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

  private async showDiagnostics(): Promise<void> {
    try {
      const text = await buildDiagnostics(this.app, this.manifest.version);
      new DiagnosticsModal(this.app, text).open();
    } catch (err) {
      this.log.error("diagnostics failed", err);
      new Notice(`${PLUGIN_NAME}: diagnostics failed: ${String(err)}`);
    }
  }
}
