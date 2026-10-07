import { Notice, Platform, Plugin } from "obsidian";
import { PLUGIN_NAME } from "./constants";
import { createLogger, type Logger } from "./logger";
import { migrateSettings, type SelectivePrintSettings } from "./settings";
import { buildDiagnostics, DiagnosticsModal } from "./spikes/diagnostics";
import { runPrintSpike } from "./spikes/print-spike";

/** Plugin entry: wiring only. Business logic lives in src/core (CLAUDE.md section 3.6). */
export default class SelectivePrintPlugin extends Plugin {
  declare settings: SelectivePrintSettings;
  private log!: Logger;
  private readonly pendingCleanups = new Set<() => void>();

  async onload(): Promise<void> {
    this.settings = migrateSettings(await this.loadData());
    this.log = createLogger(() => this.settings.debugLogging);

    if (!Platform.isDesktopApp || !Platform.isMacOS) {
      new Notice(`${PLUGIN_NAME} supports Obsidian desktop on macOS only. The plugin is inactive.`);
      return;
    }

    this.addCommand({
      id: "spike-print-sample",
      name: "Spike print test: sample note",
      callback: () => {
        void runPrintSpike(this.app, this.log, { sandbox: true, pending: this.pendingCleanups });
      },
    });
    this.addCommand({
      id: "spike-print-sample-unsandboxed",
      name: "Spike print test: sample note without iframe sandbox",
      callback: () => {
        void runPrintSpike(this.app, this.log, { sandbox: false, pending: this.pendingCleanups });
      },
    });
    this.addCommand({
      id: "show-diagnostics",
      name: "Show diagnostics",
      callback: () => {
        void this.showDiagnostics();
      },
    });

    this.log.debug("loaded");
  }

  onunload(): void {
    for (const cleanup of Array.from(this.pendingCleanups)) cleanup();
    this.pendingCleanups.clear();
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
