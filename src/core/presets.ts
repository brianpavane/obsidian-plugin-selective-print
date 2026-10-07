import { validateRuleEntry } from "./selection";
import type { PropertiesMode } from "./filter";

/**
 * Preset schema v1 (SPEC 3.3): validation, matching and specificity. Pure.
 * The Obsidian layer parses each preset file's YAML frontmatter and passes the object here.
 * The schema is frozen after Gate C; changes need a migration and a gate.
 */

export const PRESET_MARKER_KEY = "selective-print-preset";
export const PRESET_VERSION = 1;

export type OutputFormatId = "print" | "pdf" | "html" | "markdown";

export type MatcherCondition =
  | { kind: "property"; property: string; equals: string | number | boolean }
  | { kind: "tag"; tag: string }
  | { kind: "folder"; folder: string }
  | { kind: "filename"; pattern: string };

/** All conditions in one entry must hold (all-of). Entries combine any-of. */
export type MatcherEntry = MatcherCondition[];

export interface Preset {
  name: string;
  description: string;
  appliesTo: MatcherEntry[];
  sections: { inheritGlobal: boolean; exclude: string[]; skipEmpty?: boolean };
  includeTitle: boolean;
  properties: { mode: PropertiesMode; list: string[] };
  callouts: { excludeTypes: string[] };
  inlineMarkers: boolean;
  /** Unset fields fall back to plugin settings. */
  output: {
    format?: OutputFormatId;
    pdfFolder?: string;
    filename?: string;
    paper?: "letter" | "a4";
    orientation?: "portrait" | "landscape";
    footer?: string;
  };
  starterVersion?: number;
  builtin: boolean;
  /** Vault path of the preset file; undefined for built-ins. */
  file?: string;
}

export interface PresetIssue {
  file: string;
  field: string;
  message: string;
}

export interface PresetValidation {
  /** Present when there are no errors. */
  preset?: Preset;
  errors: PresetIssue[];
  warnings: PresetIssue[];
}

function builtin(name: string, description: string, inheritGlobal: boolean): Preset {
  return {
    name,
    description,
    appliesTo: [],
    sections: { inheritGlobal, exclude: [] },
    includeTitle: true,
    properties: { mode: "all", list: [] },
    callouts: { excludeTypes: [] },
    inlineMarkers: true,
    output: {},
    builtin: true,
  };
}

/** Built-in "Default": the global exclude list applies. */
export const DEFAULT_PRESET: Preset = builtin("Default", "Global exclude list applies", true);
/** Built-in "Everything": no exclusions at all. */
export const EVERYTHING_PRESET: Preset = builtin("Everything", "No exclusions", false);
export const BUILTIN_PRESETS: readonly Preset[] = [DEFAULT_PRESET, EVERYTHING_PRESET];

const TOP_KEYS = new Set([
  PRESET_MARKER_KEY,
  "preset-version",
  "starter-version",
  "name",
  "description",
  "applies-to",
  "sections",
  "include-title",
  "properties",
  "callouts",
  "inline-markers",
  "output",
]);
const SECTION_KEYS = new Set(["inherit-global", "exclude", "skip-empty"]);
const PROPERTY_KEYS = new Set(["mode", "list"]);
const CALLOUT_KEYS = new Set(["exclude-types"]);
const OUTPUT_KEYS = new Set(["format", "pdf-folder", "filename", "paper", "orientation", "footer"]);
const MATCHER_KEYS = new Set(["property", "equals", "tag", "folder", "filename-matches"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "a list";
  if (v instanceof Date) return "a date";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v;
}

class Checker {
  readonly errors: PresetIssue[] = [];
  readonly warnings: PresetIssue[] = [];
  constructor(private readonly file: string) {}

  error(field: string, message: string): void {
    this.errors.push({ file: this.file, field, message });
  }
  warn(field: string, message: string): void {
    this.warnings.push({ file: this.file, field, message });
  }

  unknownKeys(obj: Record<string, unknown>, allowed: Set<string>, prefix: string): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) this.warn(prefix + key, "unknown key (ignored)");
    }
  }

  bool(obj: Record<string, unknown>, key: string, field: string, fallback: boolean): boolean {
    const v = obj[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v === "boolean") return v;
    this.error(field, `expected true or false, got ${describe(v)}`);
    return fallback;
  }

  str(obj: Record<string, unknown>, key: string, field: string): string | undefined {
    const v = obj[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string") return v;
    this.error(field, `expected text, got ${describe(v)}`);
    return undefined;
  }

  oneOf<T extends string>(
    obj: Record<string, unknown>,
    key: string,
    field: string,
    allowed: readonly T[],
  ): T | undefined {
    const v = this.str(obj, key, field);
    if (v === undefined) return undefined;
    if ((allowed as readonly string[]).includes(v)) return v as T;
    this.error(field, `expected one of ${allowed.join(", ")}, got "${v}"`);
    return undefined;
  }

  strList(obj: Record<string, unknown>, key: string, field: string): string[] {
    const v = obj[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      this.error(field, `expected a list, got ${describe(v)}`);
      return [];
    }
    const out: string[] = [];
    v.forEach((item, i) => {
      if (typeof item === "string") out.push(item);
      else this.error(`${field}[${i}]`, `expected text, got ${describe(item)}`);
    });
    return out;
  }

  section(obj: Record<string, unknown>, key: string): Record<string, unknown> {
    const v = obj[key];
    if (v === undefined || v === null) return {};
    if (isRecord(v)) return v;
    this.error(key, `expected a group of settings, got ${describe(v)}`);
    return {};
  }
}

function parseMatcherEntry(raw: unknown, field: string, c: Checker): MatcherEntry | null {
  if (!isRecord(raw)) {
    c.error(
      field,
      `expected a matcher such as "property: type" + "equals: meeting", got ${describe(raw)}`,
    );
    return null;
  }
  for (const key of Object.keys(raw)) {
    if (!MATCHER_KEYS.has(key)) c.error(`${field}.${key}`, "unknown matcher key");
  }
  const entry: MatcherEntry = [];
  if (raw.property !== undefined) {
    const property = c.str(raw, "property", `${field}.property`);
    const equals = raw.equals;
    if (equals === undefined) c.error(`${field}.equals`, '"property" needs "equals"');
    else if (
      typeof equals !== "string" &&
      typeof equals !== "number" &&
      typeof equals !== "boolean"
    ) {
      c.error(`${field}.equals`, `expected text, a number or true/false, got ${describe(equals)}`);
    } else if (property) entry.push({ kind: "property", property, equals });
  } else if (raw.equals !== undefined) {
    c.error(`${field}.equals`, '"equals" needs "property"');
  }
  const tag = c.str(raw, "tag", `${field}.tag`);
  if (tag !== undefined) entry.push({ kind: "tag", tag });
  const folder = c.str(raw, "folder", `${field}.folder`);
  if (folder !== undefined) entry.push({ kind: "folder", folder });
  const pattern = c.str(raw, "filename-matches", `${field}.filename-matches`);
  if (pattern !== undefined) entry.push({ kind: "filename", pattern });
  if (entry.length === 0 && c.errors.every((e) => !e.field.startsWith(field))) {
    c.error(field, "matcher has no conditions");
  }
  return entry.length ? entry : null;
}

/** Validate one preset file's frontmatter. Errors make the preset unusable; warnings do not. */
export function validatePreset(frontmatter: unknown, file: string): PresetValidation {
  const c = new Checker(file);
  if (!isRecord(frontmatter)) {
    c.error("(frontmatter)", "file has no frontmatter");
    return { errors: c.errors, warnings: c.warnings };
  }
  const fm = frontmatter;
  if (fm[PRESET_MARKER_KEY] !== true) c.error(PRESET_MARKER_KEY, "required and must be true");
  if (fm["preset-version"] === undefined) c.error("preset-version", "required");
  else if (fm["preset-version"] !== PRESET_VERSION) {
    c.error(
      "preset-version",
      `unsupported version ${describe(fm["preset-version"])}; this plugin reads version ${PRESET_VERSION}`,
    );
  }
  const name = c.str(fm, "name", "name")?.trim();
  if (fm.name === undefined || name === "") c.error("name", "required");
  c.unknownKeys(fm, TOP_KEYS, "");

  const starter = fm["starter-version"];
  if (starter !== undefined && (typeof starter !== "number" || !Number.isInteger(starter))) {
    c.error("starter-version", `expected a whole number, got ${describe(starter)}`);
  }

  const appliesTo: MatcherEntry[] = [];
  const rawApplies = fm["applies-to"];
  if (rawApplies !== undefined && rawApplies !== null) {
    if (!Array.isArray(rawApplies))
      c.error("applies-to", `expected a list of matchers, got ${describe(rawApplies)}`);
    else
      rawApplies.forEach((m, i) => {
        const entry = parseMatcherEntry(m, `applies-to[${i}]`, c);
        if (entry) appliesTo.push(entry);
      });
  }

  const sections = c.section(fm, "sections");
  c.unknownKeys(sections, SECTION_KEYS, "sections.");
  const exclude = c.strList(sections, "exclude", "sections.exclude");
  exclude.forEach((entry, i) => {
    const problem = validateRuleEntry(entry);
    if (problem) c.error(`sections.exclude[${i}]`, `"${entry}": ${problem}`);
  });
  const skipEmptyRaw = sections["skip-empty"];
  const skipEmpty =
    skipEmptyRaw === undefined
      ? undefined
      : c.bool(sections, "skip-empty", "sections.skip-empty", true);

  const properties = c.section(fm, "properties");
  c.unknownKeys(properties, PROPERTY_KEYS, "properties.");
  const callouts = c.section(fm, "callouts");
  c.unknownKeys(callouts, CALLOUT_KEYS, "callouts.");
  const output = c.section(fm, "output");
  c.unknownKeys(output, OUTPUT_KEYS, "output.");

  const preset: Preset = {
    name: name ?? "",
    description: c.str(fm, "description", "description") ?? "",
    appliesTo,
    sections: {
      inheritGlobal: c.bool(sections, "inherit-global", "sections.inherit-global", true),
      exclude,
    },
    includeTitle: c.bool(fm, "include-title", "include-title", true),
    properties: {
      mode:
        c.oneOf(properties, "mode", "properties.mode", ["none", "all", "except"] as const) ?? "all",
      list: c.strList(properties, "list", "properties.list"),
    },
    callouts: { excludeTypes: c.strList(callouts, "exclude-types", "callouts.exclude-types") },
    inlineMarkers: c.bool(fm, "inline-markers", "inline-markers", true),
    output: {},
    builtin: false,
    file,
  };
  if (skipEmpty !== undefined) preset.sections.skipEmpty = skipEmpty;
  if (typeof starter === "number") preset.starterVersion = starter;

  const o = preset.output;
  const format = c.oneOf(output, "format", "output.format", [
    "print",
    "pdf",
    "html",
    "markdown",
  ] as const);
  if (format) o.format = format;
  const pdfFolder = c.str(output, "pdf-folder", "output.pdf-folder");
  if (pdfFolder) o.pdfFolder = pdfFolder;
  const filename = c.str(output, "filename", "output.filename");
  if (filename) o.filename = filename;
  const paper = c.oneOf(output, "paper", "output.paper", ["letter", "a4"] as const);
  if (paper) o.paper = paper;
  const orientation = c.oneOf(output, "orientation", "output.orientation", [
    "portrait",
    "landscape",
  ] as const);
  if (orientation) o.orientation = orientation;
  const footer = c.str(output, "footer", "output.footer");
  if (footer) o.footer = footer;

  if (c.errors.length) return { errors: c.errors, warnings: c.warnings };
  return { preset, errors: c.errors, warnings: c.warnings };
}

export interface PresetSetResult {
  presets: Preset[];
  errors: PresetIssue[];
  warnings: PresetIssue[];
}

/**
 * Validate a set of preset files. Invalid files are reported and skipped. Names must be
 * unique (case-insensitive) across files and built-ins; later duplicates are skipped.
 */
export function validatePresetSet(
  files: readonly { file: string; frontmatter: unknown }[],
): PresetSetResult {
  const result: PresetSetResult = { presets: [], errors: [], warnings: [] };
  const seen = new Map<string, string>(
    BUILTIN_PRESETS.map((p) => [p.name.toLowerCase(), "built-in"]),
  );
  const sorted = [...files].sort((a, b) => a.file.localeCompare(b.file));
  for (const { file, frontmatter } of sorted) {
    const v = validatePreset(frontmatter, file);
    result.errors.push(...v.errors);
    result.warnings.push(...v.warnings);
    if (!v.preset) continue;
    const key = v.preset.name.toLowerCase();
    const owner = seen.get(key);
    if (owner) {
      result.errors.push({
        file,
        field: "name",
        message: `duplicate preset name "${v.preset.name}" (already used by ${owner}); this file is skipped`,
      });
      continue;
    }
    seen.set(key, file);
    result.presets.push(v.preset);
  }
  return result;
}

/** What the matcher needs to know about a note. Supplied by the Obsidian layer. */
export interface NoteFacts {
  /** Vault-relative path, e.g. "Meetings/2026-10-07 Weekly sync.md". */
  path: string;
  /** Frontmatter properties (may be empty). */
  properties: Readonly<Record<string, unknown>>;
  /** All tags on the note (frontmatter and inline), with or without a leading "#". */
  tags: readonly string[];
}

const KIND_WEIGHT: Record<MatcherCondition["kind"], number> = {
  property: 4,
  tag: 3,
  folder: 2,
  filename: 1,
};

function norm(v: string): string {
  return v.trim().toLowerCase();
}

function stripHash(tag: string): string {
  return norm(tag).replace(/^#/, "");
}

function basenameOf(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/i, "");
}

/** Case-insensitive glob: `*` any run of characters, `?` one character. */
export function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .split("")
    .map((ch) => (ch === "*" ? ".*" : ch === "?" ? "." : ch.replace(/[.+^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${body}$`, "i");
}

function propertyEquals(value: unknown, want: string | number | boolean): boolean {
  if (Array.isArray(value)) return value.some((v) => propertyEquals(v, want));
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return false;
  }
  return norm(String(value)) === norm(String(want));
}

function findProperty(props: Readonly<Record<string, unknown>>, name: string): unknown {
  const key = Object.keys(props).find((k) => norm(k) === norm(name));
  return key === undefined ? undefined : props[key];
}

export function conditionMatches(c: MatcherCondition, note: NoteFacts): boolean {
  switch (c.kind) {
    case "property":
      return propertyEquals(findProperty(note.properties, c.property), c.equals);
    case "tag": {
      const want = stripHash(c.tag);
      // Nested tags: "customer" also matches "customer/acme", as Obsidian's tag search does.
      return note.tags.some((t) => {
        const have = stripHash(t);
        return have === want || have.startsWith(`${want}/`);
      });
    }
    case "folder": {
      const folder = norm(c.folder).replace(/^\/+|\/+$/g, "");
      if (folder === "") return !note.path.includes("/");
      return norm(note.path).startsWith(`${folder}/`);
    }
    case "filename":
      return globToRegExp(c.pattern.trim()).test(basenameOf(note.path));
  }
}

export interface PresetMatch {
  preset: Preset;
  /** Higher is more specific. 0 for presets that do not match. */
  specificity: number;
  /** True when chosen by the note's `print-preset` key. */
  forced: boolean;
}

/** Specificity of one entry: strongest condition kind first, then number of conditions. */
function entryScore(entry: MatcherEntry): number {
  return Math.max(...entry.map((c) => KIND_WEIGHT[c.kind])) * 10 + entry.length;
}

export interface MatchResult {
  /** Matching presets, most specific first. The first one is the dialog's default selection. */
  matches: PresetMatch[];
  /** Set when `print-preset` names a preset that does not exist. */
  warning?: string;
}

/**
 * Find presets that apply to a note, most specific first: property > tag > folder > filename.
 * A note's `print-preset` always wins. Never picks silently between several matches: the
 * caller lists all of them (see `orderForDropdown`).
 */
export function matchPresets(presets: readonly Preset[], note: NoteFacts): MatchResult {
  const matches: PresetMatch[] = [];
  for (const preset of presets) {
    let best = 0;
    for (const entry of preset.appliesTo) {
      if (entry.every((c) => conditionMatches(c, note))) best = Math.max(best, entryScore(entry));
    }
    if (best > 0) matches.push({ preset, specificity: best, forced: false });
  }
  matches.sort(
    (a, b) => b.specificity - a.specificity || a.preset.name.localeCompare(b.preset.name),
  );

  const forcedName = findProperty(note.properties, "print-preset");
  if (typeof forcedName !== "string" || forcedName.trim() === "") return { matches };
  const all = [...presets, ...BUILTIN_PRESETS];
  const forced = all.find((p) => norm(p.name) === norm(forcedName));
  if (!forced) return { matches, warning: `print-preset: no preset named "${forcedName.trim()}"` };
  return {
    matches: [
      { preset: forced, specificity: Number.POSITIVE_INFINITY, forced: true },
      ...matches.filter((m) => m.preset !== forced),
    ],
  };
}

/**
 * Dropdown order (SPEC 3.1): matching presets (most specific first), then all other presets
 * by name, then the built-in Default and Everything.
 */
export function orderForDropdown(presets: readonly Preset[], match: MatchResult): Preset[] {
  const first = match.matches.map((m) => m.preset);
  const rest = presets
    .filter((p) => !first.includes(p))
    .sort((a, b) => a.name.localeCompare(b.name));
  const builtins = BUILTIN_PRESETS.filter((p) => !first.includes(p));
  return [...first, ...rest, ...builtins];
}

/** The preset the dialog selects by default: the first match, else built-in Default. */
export function defaultPreset(match: MatchResult): Preset {
  return match.matches[0]?.preset ?? DEFAULT_PRESET;
}

export interface NewPresetInput {
  name: string;
  description?: string;
  appliesTo?: MatcherEntry[];
  exclude: readonly string[];
  inheritGlobal: boolean;
  skipEmpty: boolean;
  includeTitle: boolean;
  properties: { mode: PropertiesMode; list: readonly string[] };
  excludeCalloutTypes?: readonly string[];
  inlineMarkers?: boolean;
}

function matcherToYaml(entry: MatcherEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of entry) {
    if (c.kind === "property") {
      out.property = c.property;
      out.equals = c.equals;
    } else if (c.kind === "tag") out.tag = c.tag;
    else if (c.kind === "folder") out.folder = c.folder;
    else out["filename-matches"] = c.pattern;
  }
  return out;
}

/**
 * Frontmatter object for a new preset file, in schema order. The Obsidian layer serializes it
 * with stringifyYaml. `validatePreset` accepts every object this returns (tested).
 */
export function presetFrontmatter(input: NewPresetInput): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    [PRESET_MARKER_KEY]: true,
    "preset-version": PRESET_VERSION,
    name: input.name.trim(),
  };
  if (input.description) fm.description = input.description;
  fm["applies-to"] = (input.appliesTo ?? []).map(matcherToYaml);
  fm.sections = {
    "inherit-global": input.inheritGlobal,
    exclude: [...input.exclude],
    "skip-empty": input.skipEmpty,
  };
  fm["include-title"] = input.includeTitle;
  fm.properties = { mode: input.properties.mode, list: [...input.properties.list] };
  fm.callouts = { "exclude-types": [...(input.excludeCalloutTypes ?? [])] };
  fm["inline-markers"] = input.inlineMarkers ?? true;
  return fm;
}

/** Problem with a proposed preset name, or null when it can be used. */
export function presetNameProblem(name: string, existing: readonly Preset[]): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Enter a name.";
  const all = [...existing, ...BUILTIN_PRESETS];
  if (all.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    return `A preset named "${trimmed}" already exists.`;
  }
  return null;
}
