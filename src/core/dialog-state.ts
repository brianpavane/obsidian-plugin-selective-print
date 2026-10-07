import { descendantsAndSelf } from "./sections";
import type { Section, SectionTree } from "./types";

/**
 * Review-dialog checklist logic (SPEC 3.1). Pure: the modal only renders this state.
 * State is the set of included section ids; every operation returns a new set.
 */

export type CheckState = "checked" | "unchecked" | "mixed";

/** Rows the dialog shows: every section, plus the Preamble only when it has content. */
export function visibleSections(tree: SectionTree): Section[] {
  return tree.all.filter((s) => s.level > 0 || !s.isEmpty);
}

/** Nesting depth per section id (roots and Preamble are 0). */
export function depths(tree: SectionTree): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (s: Section, d: number): void => {
    out.set(s.id, d);
    s.children.forEach((c) => walk(c, d + 1));
  };
  if (tree.preamble) out.set(tree.preamble.id, 0);
  tree.roots.forEach((r) => walk(r, 0));
  return out;
}

/** Checked when the section and all descendants are included; mixed when they differ. */
export function checkState(section: Section, included: ReadonlySet<string>): CheckState {
  const ids = descendantsAndSelf(section).map((s) => s.id);
  const n = ids.filter((id) => included.has(id)).length;
  if (n === 0) return "unchecked";
  return n === ids.length ? "checked" : "mixed";
}

/** Toggling a parent toggles its whole subtree: fully checked becomes unchecked, else checked. */
export function toggleSection(section: Section, included: ReadonlySet<string>): Set<string> {
  const next = new Set(included);
  const on = checkState(section, included) !== "checked";
  for (const s of descendantsAndSelf(section)) {
    if (on) next.add(s.id);
    else next.delete(s.id);
  }
  return next;
}

export function selectAll(tree: SectionTree): Set<string> {
  return new Set(tree.all.map((s) => s.id));
}

export function selectNone(): Set<string> {
  return new Set();
}

/** Flip every section's own state. */
export function invertSelection(tree: SectionTree, included: ReadonlySet<string>): Set<string> {
  return new Set(tree.all.filter((s) => !included.has(s.id)).map((s) => s.id));
}

/** Short size hint for a row, e.g. "42 words" or "1,204 words". */
export function sizeHint(section: Section): string {
  const n = section.wordCount;
  return `${n.toLocaleString("en-US")} ${n === 1 ? "word" : "words"}`;
}
