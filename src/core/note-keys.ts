import type { CoreWarning, SectionTree } from "./types";

/**
 * Note-level frontmatter keys (SPEC 3.3):
 *   print-preset:  force a preset by name
 *   print-exclude: complete list of headings to exclude; replaces preset and global lists
 *                  (present but empty = include everything)
 */

export const NOTE_PRESET_KEY = "print-preset";
export const NOTE_EXCLUDE_KEY = "print-exclude";

export interface NoteOverrides {
  /** null when the note has no print-exclude key. */
  noteExclude: string[] | null;
  forcedPreset: string | null;
  warnings: CoreWarning[];
}

function find(
  props: Readonly<Record<string, unknown>>,
  key: string,
): { present: boolean; value: unknown } {
  const k = Object.keys(props).find((p) => p.toLowerCase() === key);
  return k === undefined
    ? { present: false, value: undefined }
    : { present: true, value: props[k] };
}

export function readNoteOverrides(props: Readonly<Record<string, unknown>>): NoteOverrides {
  const warnings: CoreWarning[] = [];
  const ex = find(props, NOTE_EXCLUDE_KEY);
  let noteExclude: string[] | null = null;
  if (ex.present) {
    if (ex.value === null || ex.value === undefined || ex.value === "") noteExclude = [];
    else if (typeof ex.value === "string") noteExclude = [ex.value];
    else if (Array.isArray(ex.value) && ex.value.every((v) => typeof v === "string")) {
      noteExclude = ex.value.filter((v) => v.trim() !== "");
    } else {
      warnings.push({
        code: "note-key",
        message: `${NOTE_EXCLUDE_KEY} should be a list of heading names; it is ignored`,
      });
    }
  }
  const pr = find(props, NOTE_PRESET_KEY);
  const forcedPreset =
    typeof pr.value === "string" && pr.value.trim() !== "" ? pr.value.trim() : null;
  if (pr.present && forcedPreset === null && pr.value !== null && pr.value !== "") {
    warnings.push({
      code: "note-key",
      message: `${NOTE_PRESET_KEY} should be a preset name; it is ignored`,
    });
  }
  return { noteExclude, forcedPreset, warnings };
}

export interface RememberPlan {
  /** Heading names to write to print-exclude (unique, case-insensitive, document order). */
  list: string[];
  /** Where the remembered list will not reproduce this exact selection next time. */
  warnings: CoreWarning[];
}

/**
 * The print-exclude list that reproduces a dialog selection as closely as heading-name
 * rules can. Rules match by name and take descendants along, so a few selections cannot be
 * stored exactly; those are reported.
 */
export function rememberList(tree: SectionTree, included: ReadonlySet<string>): RememberPlan {
  const list: string[] = [];
  const seen = new Set<string>();
  const warnings: CoreWarning[] = [];
  const lossy = (message: string): void => {
    warnings.push({ code: "remember-lossy", message });
  };

  for (const s of tree.all) {
    if (included.has(s.id)) continue;
    if (s.level === 0) {
      if (!s.isEmpty)
        lossy("The preamble (text before the first heading) cannot be remembered as excluded.");
      continue;
    }
    const name = (s.plainTitle || s.title).trim();
    if (name === "") {
      lossy("A heading without text cannot be remembered as excluded.");
      continue;
    }
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      list.push(name);
    }
  }

  for (const s of tree.all) {
    if (s.level === 0 || !included.has(s.id)) continue;
    const name = (s.plainTitle || s.title).trim().toLowerCase();
    if (seen.has(name)) {
      lossy(
        `"${s.plainTitle}" appears more than once; every occurrence will be excluded next time.`,
      );
    }
  }
  // Included sections under an excluded parent: the rule takes them along next time.
  const walk = (s: (typeof tree.roots)[number]): void => {
    if (!included.has(s.id)) {
      for (const c of s.children) {
        if (anyIncluded(c, included)) {
          lossy(
            `Parts of "${s.plainTitle}" were included, but next time the whole section will be excluded.`,
          );
          return;
        }
      }
      return;
    }
    s.children.forEach(walk);
  };
  tree.roots.forEach(walk);
  return { list, warnings };
}

function anyIncluded(s: SectionTree["roots"][number], included: ReadonlySet<string>): boolean {
  return included.has(s.id) || s.children.some((c) => anyIncluded(c, included));
}
