import { BlockScanner, parseSections, splitLines } from "./sections";
import type { CoreWarning, SectionTree } from "./types";

/**
 * Content filtering (SPEC 3.4), applied in this order:
 *   1. split frontmatter from body
 *   2. apply the section selection
 *   3. remove `%% print:exclude %% ... %% /print:exclude %%` blocks
 *   4. remove callouts of excluded types (with nested content)
 *   5. drop empty sections (when skip-empty is on)
 *   6. filter properties for the frontmatter rendering
 * Every step is a pure function over strings or plain objects.
 */

/** Step 2: keep the own slice (heading + own content) of every included section. */
export function applySelection(tree: SectionTree, included: ReadonlySet<string>): string {
  let out = "";
  for (const s of tree.all) {
    if (included.has(s.id)) out += tree.lines.slice(s.startLine, s.ownEndLine).join("");
  }
  return out;
}

const MARKER = /%%\s*(\/?)print:exclude\s*%%/g;

export interface TextResult {
  text: string;
  warnings: CoreWarning[];
}

/**
 * Step 3: remove inline-marker regions. Fence-aware (markers inside code are literal),
 * nestable, inline or multi-line. Regions are scoped to one section's own content: a start
 * marker still open at the next heading is unmatched, excludes up to that heading and produces
 * a warning. An unmatched end marker is removed with a warning.
 */
export function removeExcludeMarkers(body: string): TextResult {
  const lines = splitLines(body);
  const headingLines = new Set(
    parseSections(body, { frontmatter: false })
      .all.filter((s) => s.level > 0)
      .map((s) => s.startLine),
  );
  const warnings: CoreWarning[] = [];
  const scanner = new BlockScanner();
  let depth = 0;
  let openedAt = -1;
  let out = "";

  lines.forEach((line, i) => {
    if (headingLines.has(i) && depth > 0) {
      warnings.push({
        code: "unmatched-marker-start",
        message: `print:exclude started on line ${openedAt + 1} has no end marker; excluded to the end of its section`,
        line: openedAt + 1,
      });
      depth = 0;
    }
    const wasInFence = scanner.inFence;
    scanner.hidden(line);
    if (wasInFence || scanner.inFence) {
      if (depth === 0) out += line;
      return;
    }

    let kept = "";
    let last = 0;
    let sawMarker = false;
    for (const m of line.matchAll(MARKER)) {
      sawMarker = true;
      if (depth === 0) kept += line.slice(last, m.index);
      last = m.index + m[0].length;
      if (m[1] === "/") {
        if (depth === 0) {
          warnings.push({
            code: "unmatched-marker-end",
            message: `print:exclude end marker on line ${i + 1} has no start marker`,
            line: i + 1,
          });
        } else {
          depth--;
        }
      } else {
        if (depth === 0) openedAt = i;
        depth++;
      }
    }
    if (depth === 0) kept += line.slice(last);
    if (!sawMarker) {
      if (depth === 0) out += line;
      return;
    }
    // Drop a line that held only markers (and whatever they removed); keep its terminator otherwise.
    if (kept.trim() !== "") out += kept.endsWith("\n") ? kept : kept + eol(line);
  });

  if (depth > 0) {
    warnings.push({
      code: "unmatched-marker-start",
      message: `print:exclude started on line ${openedAt + 1} has no end marker; excluded to the end of its section`,
      line: openedAt + 1,
    });
  }
  return { text: out, warnings };
}

function eol(line: string): string {
  return line.match(/\r?\n$/)?.[0] ?? "";
}

const CALLOUT_START = /^\s*((?:>\s?)+)\[!([^\]]+)\]/;

function quoteDepth(line: string): number {
  const m = /^\s*((?:>\s?)+)/.exec(line);
  return m?.[1] ? (m[1].match(/>/g)?.length ?? 0) : 0;
}

/** Step 4: remove callouts whose type is listed (case-insensitive), including nested content. */
export function removeCallouts(body: string, excludeTypes: readonly string[]): string {
  if (excludeTypes.length === 0) return body;
  const types = new Set(excludeTypes.map((t) => t.trim().toLowerCase()));
  const scanner = new BlockScanner();
  let removingDepth = 0;
  let out = "";
  for (const line of splitLines(body)) {
    if (removingDepth > 0) {
      if (quoteDepth(line) >= removingDepth) continue;
      removingDepth = 0;
    }
    const wasInFence = scanner.inFence;
    scanner.hidden(line);
    if (!wasInFence && !scanner.inFence) {
      const m = CALLOUT_START.exec(line);
      if (m?.[2] && types.has(m[2].trim().toLowerCase())) {
        removingDepth = quoteDepth(line);
        continue;
      }
    }
    out += line;
  }
  return out;
}

export interface SkipEmptyResult {
  text: string;
  /** Headings dropped because their subtree was empty. */
  skipped: number;
}

/** Step 5: drop sections whose whole subtree is empty, and an empty preamble. */
export function skipEmptySections(body: string): SkipEmptyResult {
  const tree = parseSections(body, { frontmatter: false });
  let text = "";
  let skipped = 0;
  for (const s of tree.all) {
    if (s.isEmpty) {
      if (s.level > 0) skipped++;
      continue;
    }
    text += tree.lines.slice(s.startLine, s.ownEndLine).join("");
  }
  return { text, skipped };
}

export type PropertiesMode = "none" | "all" | "except";

/** Step 6: choose which properties to render. Names compare case-insensitively. */
export function filterProperties(
  properties: Readonly<Record<string, unknown>>,
  mode: PropertiesMode,
  list: readonly string[] = [],
): Record<string, unknown> {
  if (mode === "none") return {};
  const out: Record<string, unknown> = {};
  const omit = new Set(mode === "except" ? list.map((k) => k.trim().toLowerCase()) : []);
  for (const [key, value] of Object.entries(properties)) {
    if (!omit.has(key.toLowerCase())) out[key] = value;
  }
  return out;
}

export interface FilterOptions {
  /** Included section ids (from `finalSelection`). */
  included: ReadonlySet<string>;
  inlineMarkers: boolean;
  excludeCalloutTypes: readonly string[];
  skipEmpty: boolean;
  properties?: {
    values: Readonly<Record<string, unknown>>;
    mode: PropertiesMode;
    list?: readonly string[];
  };
}

export interface FilterResult {
  /** Filtered Markdown body, without frontmatter. This is what the renderer receives. */
  body: string;
  /** Filtered properties, when `properties` was given. */
  properties?: Record<string, unknown>;
  warnings: CoreWarning[];
  stats: { included: number; excluded: number; emptySkipped: number };
}

/** The whole pipeline (steps 1-6) for one invocation. */
export function filterNote(tree: SectionTree, opts: FilterOptions): FilterResult {
  const warnings: CoreWarning[] = [];
  const sections = tree.all.filter((s) => s.level > 0);
  const included = sections.filter((s) => opts.included.has(s.id)).length;

  let body = applySelection(tree, opts.included);
  if (opts.inlineMarkers) {
    const r = removeExcludeMarkers(body);
    body = r.text;
    warnings.push(...r.warnings);
  }
  body = removeCallouts(body, opts.excludeCalloutTypes);
  let emptySkipped = 0;
  if (opts.skipEmpty) {
    const r = skipEmptySections(body);
    body = r.text;
    emptySkipped = r.skipped;
  }

  const result: FilterResult = {
    body,
    warnings,
    stats: {
      included: Math.max(0, included - emptySkipped),
      excluded: sections.length - included,
      emptySkipped,
    },
  };
  if (opts.properties) {
    result.properties = filterProperties(
      opts.properties.values,
      opts.properties.mode,
      opts.properties.list,
    );
  }
  return result;
}
