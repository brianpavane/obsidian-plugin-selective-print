import { apiVersion, App, Modal, Notice, Platform } from "obsidian";
import { detectElectronCapabilities, probePrintToPdf } from "../output/electron-bridge";

/**
 * Report environment and Electron capabilities (from Spike B). Contains no note content.
 * Used to diagnose problems; becomes "Copy diagnostics" in settings at M5.
 */
export async function buildDiagnostics(app: App, pluginVersion: string): Promise<string> {
  const caps = detectElectronCapabilities();
  const probe = caps.printToPDF ? await probePrintToPdf() : null;
  const lines = [
    `Selective Print ${pluginVersion}`,
    `Obsidian API version: ${apiVersion}`,
    `Platform: desktopApp=${String(Platform.isDesktopApp)} macOS=${String(Platform.isMacOS)}`,
    `Electron: ${caps.versions.electron ?? "unknown"}  Chrome: ${caps.versions.chrome ?? "unknown"}  Node: ${caps.versions.node ?? "unknown"}`,
    "",
    `require("electron"): ${caps.electron ? "yes" : "no"}`,
    `remote: ${caps.remoteSource ?? "UNAVAILABLE"}`,
    `remote.BrowserWindow: ${caps.browserWindow ? "yes" : "no"}`,
    `webContents.printToPDF: ${caps.printToPDF ? "yes" : "no"}`,
    probe
      ? `printToPDF probe: ${probe.ok ? `ok, ${String(probe.bytes)} bytes, %PDF- header ${probe.pdfHeader ? "yes" : "NO"}` : `FAILED: ${probe.error ?? "unknown"}`}`
      : "printToPDF probe: skipped (printToPDF unavailable)",
    "",
    caps.problems.length ? `Problems:\n- ${caps.problems.join("\n- ")}` : "Problems: none",
    "",
    `Vault adapter: ${app.vault.adapter.constructor.name}`,
  ];
  return lines.join("\n");
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
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(this.text).then(
        () => new Notice("Diagnostics copied"),
        (err: unknown) => new Notice(`Copy failed: ${String(err)}`),
      );
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
