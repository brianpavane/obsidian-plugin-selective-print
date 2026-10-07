/**
 * Diagnostics report (SPEC 7.4): versions, platform, adapters, preset load results and a
 * settings summary. It never contains note content: only counts, names of presets and preset
 * file paths. Pure, so that property is tested.
 */

export interface DiagnosticsInfo {
  pluginVersion: string;
  obsidianVersion: string;
  platform: { desktopApp: boolean; macOS: boolean };
  versions: { electron?: string; chrome?: string; node?: string };
  electron: {
    remote: string | null;
    browserWindow: boolean;
    printToPDF: boolean;
    problems: string[];
  };
  adapters: { id: string; available: boolean; reason?: string }[];
  presets: {
    folder: string | null;
    valid: string[];
    errors: { file: string; field: string; message: string }[];
    warnings: number;
  };
  settings: {
    alwaysReview: boolean;
    defaultOutput: string;
    pdfDestination: string;
    paper: string;
    orientation: string;
    marginsIn: number;
    printStyle: string;
    skipEmpty: boolean;
    globalExcludeCount: number;
    startersInstalled: number;
    debugLogging: boolean;
  };
}

const yesNo = (v: boolean): string => (v ? "yes" : "no");

export function formatDiagnostics(d: DiagnosticsInfo): string {
  const s = d.settings;
  const lines = [
    `Selective Print ${d.pluginVersion}`,
    `Obsidian ${d.obsidianVersion}; desktop app: ${yesNo(d.platform.desktopApp)}; macOS: ${yesNo(d.platform.macOS)}`,
    `Electron ${d.versions.electron ?? "unknown"}; Chrome ${d.versions.chrome ?? "unknown"}; Node ${d.versions.node ?? "unknown"}`,
    "",
    "Electron capabilities",
    `  remote: ${d.electron.remote ?? "unavailable"}`,
    `  BrowserWindow: ${yesNo(d.electron.browserWindow)}`,
    `  printToPDF: ${yesNo(d.electron.printToPDF)}`,
    ...d.electron.problems.map((p) => `  problem: ${p}`),
    "",
    "Output adapters",
    ...d.adapters.map(
      (a) => `  ${a.id}: ${a.available ? "available" : `unavailable (${a.reason ?? "unknown"})`}`,
    ),
    "",
    `Presets (folder: ${d.presets.folder === null ? "INVALID (outside the vault)" : d.presets.folder || "/"})`,
    `  valid: ${d.presets.valid.length}${d.presets.valid.length ? ` (${d.presets.valid.join(", ")})` : ""}`,
    `  errors: ${d.presets.errors.length}; warnings: ${d.presets.warnings}`,
    ...d.presets.errors.map((e) => `  error: ${e.file}: ${e.field}: ${e.message}`),
    "",
    "Settings",
    `  always review: ${yesNo(s.alwaysReview)}; default output: ${s.defaultOutput}; PDF destination: ${s.pdfDestination}`,
    `  paper: ${s.paper} ${s.orientation}, margins ${s.marginsIn} in; style: ${s.printStyle}; skip empty: ${yesNo(s.skipEmpty)}`,
    `  global exclude entries: ${s.globalExcludeCount}; starters installed: ${s.startersInstalled}; debug logging: ${yesNo(s.debugLogging)}`,
  ];
  return lines.join("\n");
}
