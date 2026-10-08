import { descendantsAndSelf } from "./sections";
import { compileRules } from "./selection";
import type { CoreWarning, SectionTree } from "./types";

/**
 * Digest packs (0.7.0, approved by Brian 2026-10-07 as a packs-only exception to the
 * exclude-only rule): keep only the named sections of each note. Exclusions still win: the
 * result is the intersection of the digest sections (with their subsections) and the note's
 * normally included sections, so a digest can never bring back an excluded Transcript.
 */

export const DEFAULT_DIGEST_SECTIONS: readonly string[] = ["Decisions", "Action items"];

export interface DigestResult {
  included: Set<string>;
  /** Invalid digest entries (bad regex, blank). */
  warnings: CoreWarning[];
}

export function digestSelection(
  tree: SectionTree,
  included: ReadonlySet<string>,
  entries: readonly string[],
): DigestResult {
  const { rules, errors } = compileRules(entries.filter((e) => e.trim() !== ""));
  const wanted = new Set<string>();
  for (const s of tree.all) {
    if (rules.some((r) => r.test(s))) for (const d of descendantsAndSelf(s)) wanted.add(d.id);
  }
  return { included: new Set([...included].filter((id) => wanted.has(id))), warnings: errors };
}

/** Parse the settings text (one heading per line) into entries. */
export function parseDigestList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}
