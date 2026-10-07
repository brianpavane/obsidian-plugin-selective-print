import { descendantsAndSelf } from "./sections";
import type { CoreWarning, ExclusionSource, Section, SectionDefault, SectionTree } from "./types";

/**
 * Exclusion resolution. Exclude-only through v1.0: there are no include lists.
 *
 * Precedence, highest first:
 *   1. dialog selection (per section id)
 *   2. note frontmatter `print-exclude` (present => replaces 3 and 4 entirely; [] = include all)
 *   3. preset `sections.exclude`, unioned with the global list unless `inherit-global: false`
 *   4. global exclude list from settings
 *   5. include everything
 *
 * Rules match heading text case-insensitively after trimming, at any level. An entry
 * `regex:<pattern>` is a case-insensitive regular expression. Rules never match the Preamble
 * pseudo-section. Excluding a section excludes its descendants by default.
 */

export const REGEX_PREFIX = "regex:";

export interface CompiledRule {
  /** The entry as written, used in messages and drift warnings. */
  entry: string;
  test(section: Section): boolean;
}

export interface CompiledRules {
  rules: CompiledRule[];
  /** Invalid entries (empty text, bad regex). They are skipped, never fatal. */
  errors: CoreWarning[];
}

export function normalizeHeading(text: string): string {
  return text.trim().toLowerCase();
}

/** Validate one rule entry. Returns an error message, or null when valid. */
export function validateRuleEntry(entry: string): string | null {
  if (entry.trim() === "") return "empty heading name";
  const trimmed = entry.trim();
  if (trimmed.toLowerCase().startsWith(REGEX_PREFIX)) {
    const pattern = trimmed.slice(REGEX_PREFIX.length);
    if (pattern === "") return "empty regular expression";
    try {
      new RegExp(pattern, "i");
    } catch (err) {
      return `invalid regular expression: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return null;
}

export function compileRules(entries: readonly string[]): CompiledRules {
  const rules: CompiledRule[] = [];
  const errors: CoreWarning[] = [];
  for (const entry of entries) {
    const problem = validateRuleEntry(entry);
    if (problem) {
      errors.push({ code: "invalid-rule", message: `"${entry}": ${problem}` });
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed.toLowerCase().startsWith(REGEX_PREFIX)) {
      const re = new RegExp(trimmed.slice(REGEX_PREFIX.length), "i");
      rules.push({
        entry,
        test: (s) => s.level > 0 && (re.test(s.plainTitle.trim()) || re.test(s.title.trim())),
      });
    } else {
      const want = normalizeHeading(trimmed);
      rules.push({
        entry,
        test: (s) =>
          s.level > 0 &&
          (normalizeHeading(s.plainTitle) === want || normalizeHeading(s.title) === want),
      });
    }
  }
  return { rules, errors };
}

export interface PresetSectionRules {
  exclude: readonly string[];
  inheritGlobal: boolean;
}

export interface ResolveInput {
  tree: SectionTree;
  globalExclude: readonly string[];
  /** The active preset's section rules; null or undefined for the built-in Default. */
  preset?: PresetSectionRules | null;
  /** The note's `print-exclude` list when the key is present (even if empty); otherwise null. */
  noteExclude?: readonly string[] | null;
}

export interface ResolveResult {
  /** One entry per section in `tree.all` order. */
  defaults: SectionDefault[];
  warnings: CoreWarning[];
}

/** Compute the default (pre-dialog) state of every section. */
export function resolveDefaults(input: ResolveInput): ResolveResult {
  const warnings: CoreWarning[] = [];
  const layers: { source: ExclusionSource; rules: CompiledRule[] }[] = [];

  const add = (source: ExclusionSource, entries: readonly string[]): void => {
    const compiled = compileRules(entries);
    warnings.push(...compiled.errors);
    layers.push({ source, rules: compiled.rules });
  };

  if (input.noteExclude != null) {
    add("note", input.noteExclude);
  } else if (input.preset) {
    // Preset first so a heading named by both is tagged "preset".
    add("preset", input.preset.exclude);
    if (input.preset.inheritGlobal) add("global", input.globalExclude);
  } else {
    add("global", input.globalExclude);
  }

  const state = new Map<string, SectionDefault>();
  for (const s of input.tree.all) {
    state.set(s.id, { id: s.id, excluded: false, source: null, viaAncestor: false });
  }

  const visit = (s: Section): void => {
    const current = state.get(s.id);
    if (!current || current.excluded) return; // already excluded through an ancestor
    for (const layer of layers) {
      if (layer.rules.some((r) => r.test(s))) {
        current.excluded = true;
        current.source = layer.source;
        for (const d of descendantsAndSelf(s).slice(1)) {
          const ds = state.get(d.id);
          if (ds && !ds.excluded) {
            ds.excluded = true;
            ds.source = layer.source;
            ds.viaAncestor = true;
          }
        }
        return;
      }
    }
    s.children.forEach(visit);
  };
  input.tree.roots.forEach(visit);

  return { defaults: input.tree.all.map((s) => state.get(s.id) as SectionDefault), warnings };
}

/**
 * Apply the dialog's choices (level 1) on top of the defaults.
 * `overrides` maps section id to included (true) or excluded (false).
 * Returns the set of included section ids.
 */
export function finalSelection(
  defaults: readonly SectionDefault[],
  overrides: ReadonlyMap<string, boolean> = new Map(),
): Set<string> {
  const included = new Set<string>();
  for (const d of defaults) {
    const override = overrides.get(d.id);
    if (override ?? !d.excluded) included.add(d.id);
  }
  return included;
}

/**
 * Drift detection for preset rules: entries that match no heading in this note.
 * Never called for the global list or note `print-exclude` (SPEC 3.3a).
 */
export function findMissingHeadings(
  tree: SectionTree,
  presetExclude: readonly string[],
): CoreWarning[] {
  const { rules } = compileRules(presetExclude);
  return rules
    .filter((r) => !tree.all.some((s) => r.test(s)))
    .map((r) => ({ code: "not-found" as const, message: `not found: ${r.entry.trim()}` }));
}
