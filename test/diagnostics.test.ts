import { describe, expect, it } from "vitest";
import { formatDiagnostics, type DiagnosticsInfo } from "../src/core/diagnostics";

const info: DiagnosticsInfo = {
  pluginVersion: "0.4.0",
  obsidianVersion: "1.14.4",
  platform: { desktopApp: true, macOS: true },
  versions: { electron: "39.0.0", chrome: "142.0" },
  electron: { remote: "electron.remote", browserWindow: true, printToPDF: true, problems: [] },
  adapters: [
    { id: "print", available: true },
    { id: "pdf", available: false, reason: "no remote" },
  ],
  presets: {
    folder: "Print Presets",
    valid: ["Meeting notes", "Weekly review"],
    errors: [{ file: "Print Presets/Bad.md", field: "name", message: "required" }],
    warnings: 1,
  },
  settings: {
    alwaysReview: true,
    defaultOutput: "print",
    pdfDestination: "ask",
    paper: "letter",
    orientation: "portrait",
    marginsIn: 0.75,
    printStyle: "neutral",
    skipEmpty: true,
    globalExcludeCount: 1,
    startersInstalled: 5,
    debugLogging: false,
  },
};

describe("formatDiagnostics", () => {
  it("reports versions, capabilities, adapters, presets and settings", () => {
    const text = formatDiagnostics(info);
    expect(text).toContain("Selective Print 0.4.0");
    expect(text).toContain("Obsidian 1.14.4; desktop app: yes; macOS: yes");
    expect(text).toContain("Electron 39.0.0; Chrome 142.0; Node unknown");
    expect(text).toContain("  pdf: unavailable (no remote)");
    expect(text).toContain("  valid: 2 (Meeting notes, Weekly review)");
    expect(text).toContain("  error: Print Presets/Bad.md: name: required");
    expect(text).toContain("global exclude entries: 1; starters installed: 5");
  });

  it("never includes global exclude entries (only their count) and handles edge cases", () => {
    const text = formatDiagnostics({
      ...info,
      electron: {
        remote: null,
        browserWindow: false,
        printToPDF: false,
        problems: ["remote missing"],
      },
      presets: { folder: null, valid: [], errors: [], warnings: 0 },
    });
    expect(text).not.toContain("Transcript");
    expect(text).toContain("remote: unavailable");
    expect(text).toContain("  problem: remote missing");
    expect(text).toContain("INVALID (outside the vault)");
    expect(text).toContain("  valid: 0\n");
    expect(formatDiagnostics({ ...info, presets: { ...info.presets, folder: "" } })).toContain(
      "(folder: /)",
    );
  });
});
