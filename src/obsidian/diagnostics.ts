import { apiVersion, App, Modal, Notice, Platform } from "obsidian";
import { PLUGIN_NAME } from "../constants";
import { formatDiagnostics } from "../core/diagnostics";
import { checkAdapters, type OutputAdapter } from "../output/adapter";
import { detectElectronCapabilities } from "../output/electron-bridge";
import type { SelectivePrintSettings } from "../settings";
import type { PresetStore } from "./vault-presets";

/** Collect the diagnostics report. Contains no note content (see src/core/diagnostics.ts). */
export async function buildDiagnostics(
  pluginVersion: string,
  settings: SelectivePrintSettings,
  adapters: readonly OutputAdapter[],
  store: PresetStore,
): Promise<string> {
  const caps = detectElectronCapabilities();
  const availability = await checkAdapters(adapters);
  await store.reload();
  const report = store.report;
  return formatDiagnostics({
    pluginVersion,
    obsidianVersion: apiVersion,
    platform: { desktopApp: Platform.isDesktopApp, macOS: Platform.isMacOS },
    versions: caps.versions,
    electron: {
      remote: caps.remoteSource,
      browserWindow: caps.browserWindow,
      printToPDF: caps.printToPDF,
      problems: caps.problems,
    },
    adapters: [
      ...availability.available.map((a) => ({ id: a.id, available: true })),
      ...availability.unavailable.map((u) => ({
        id: u.adapter.id,
        available: false,
        reason: u.reason,
      })),
    ],
    presets: {
      folder: store.folder(),
      valid: report.presets.map((p) => p.name),
      errors: report.errors,
      warnings: report.warnings.length,
    },
    settings: {
      alwaysReview: settings.alwaysReview,
      defaultOutput: settings.defaultOutput,
      pdfDestination: settings.pdfDestination,
      paper: settings.paper,
      orientation: settings.orientation,
      marginsIn: settings.marginsIn,
      printStyle: settings.printStyle,
      skipEmpty: settings.skipEmpty,
      globalExcludeCount: settings.globalExclude.filter((e) => e.trim() !== "").length,
      startersInstalled: Object.values(settings.installedStarters).filter((v) => v > 0).length,
      debugLogging: settings.debugLogging,
    },
  });
}

export async function copyDiagnostics(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    new Notice(`${PLUGIN_NAME}: diagnostics copied (no note content included).`);
  } catch (err) {
    new Notice(`${PLUGIN_NAME}: copy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export class DiagnosticsModal extends Modal {
  constructor(
    app: App,
    private readonly text: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Diagnostics");
    this.contentEl.addClass("selective-print-diagnostics");
    this.contentEl.createEl("pre", { text: this.text });
    const button = this.contentEl.createEl("button", { text: "Copy to clipboard", cls: "mod-cta" });
    button.addEventListener("click", () => void copyDiagnostics(this.text));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
