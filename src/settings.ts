import { DEFAULT_GLOBAL_EXCLUDE, DEFAULT_PRESETS_FOLDER } from "./constants";

/**
 * Persisted plugin settings (data.json). Pure module: no Obsidian imports, so the
 * migration is unit tested. Bump SETTINGS_SCHEMA_VERSION and extend migrateSettings
 * for any change that alters the shape of existing data (CLAUDE.md section 5: ask first).
 */
export const SETTINGS_SCHEMA_VERSION = 1;

export type OutputFormat = "print" | "pdf" | "html" | "markdown";
export type PaperSize = "letter" | "a4";
export type Orientation = "portrait" | "landscape";
export type PrintStyle = "neutral" | "match-theme";

export interface SelectivePrintSettings {
  schemaVersion: number;
  alwaysReview: boolean;
  defaultOutput: OutputFormat;
  globalExclude: string[];
  presetsFolder: string;
  paper: PaperSize;
  orientation: Orientation;
  marginsIn: number;
  printStyle: PrintStyle;
  pdfFolder: string;
  filenameTemplate: string;
  openPdfInPreview: boolean;
  showHeaderIcon: boolean;
  showRibbonIcon: boolean;
  skipEmpty: boolean;
  debugLogging: boolean;
  /** Starter preset name -> starter-version last installed (0: seen but not installed). */
  installedStarters: Record<string, number>;
}

export function defaultSettings(): SelectivePrintSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    alwaysReview: true,
    defaultOutput: "print",
    globalExclude: [...DEFAULT_GLOBAL_EXCLUDE],
    presetsFolder: DEFAULT_PRESETS_FOLDER,
    paper: "letter",
    orientation: "portrait",
    marginsIn: 0.75,
    printStyle: "neutral",
    pdfFolder: "",
    filenameTemplate: "{date} - {title}",
    openPdfInPreview: false,
    showHeaderIcon: true,
    showRibbonIcon: false,
    skipEmpty: true,
    debugLogging: false,
    installedStarters: {},
  };
}

const ENUM_VALUES: Partial<Record<keyof SelectivePrintSettings, readonly string[]>> = {
  defaultOutput: ["print", "pdf", "html", "markdown"],
  paper: ["letter", "a4"],
  orientation: ["portrait", "landscape"],
  printStyle: ["neutral", "match-theme"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turn whatever is in data.json (possibly nothing, possibly an older schema) into
 * current settings. Unknown keys are dropped; values of the wrong type fall back to
 * defaults so a hand-edited data.json can never crash the plugin.
 */
export function migrateSettings(raw: unknown): SelectivePrintSettings {
  const defaults = defaultSettings();
  if (!isRecord(raw)) return defaults;

  // schemaVersion 1 is the first schema; future migrations step from older versions here.
  const result: SelectivePrintSettings = { ...defaults };
  const target = result as unknown as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof SelectivePrintSettings)[]) {
    if (key === "schemaVersion") continue;
    const value = raw[key];
    const fallback = defaults[key];
    if (value === undefined) continue;
    if (key === "installedStarters") {
      if (isRecord(value)) {
        result.installedStarters = Object.fromEntries(
          Object.entries(value).filter(
            (e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]),
          ),
        );
      }
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        target[key] = [...value];
      }
    } else if (typeof value === typeof fallback) {
      const allowed = ENUM_VALUES[key];
      if (allowed && !allowed.includes(value as string)) continue;
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      target[key] = value;
    }
  }
  result.schemaVersion = SETTINGS_SCHEMA_VERSION;
  return result;
}
