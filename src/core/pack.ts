import type { MatcherCondition } from "./presets";

/**
 * Multi-note packs (0.6.0, approved by Brian 2026-10-07): choosing, ordering and filtering the
 * notes that go into one printout. Pure.
 */

export interface PackNote {
  /** Vault path, e.g. "Meetings/2026-10-07 Weekly sync.md". */
  path: string;
  title: string;
  properties: Readonly<Record<string, unknown>>;
  tags: readonly string[];
  /** Last modified, epoch milliseconds. */
  mtime: number;
}

export type PackSort = "date" | "name" | "modified";

/** Above this many notes the pack asks before rendering. */
export const PACK_CONFIRM_THRESHOLD = 50;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** The note's date as YYYY-MM-DD: its `date` property, else a date in the file name. */
export function noteDate(note: PackNote): string | null {
  const key = Object.keys(note.properties).find((k) => k.toLowerCase() === "date");
  const value = key === undefined ? undefined : note.properties[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  const candidates = [typeof value === "string" ? value : "", note.title];
  for (const text of candidates) {
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (m && validDate(Number(m[1]), Number(m[2]), Number(m[3]))) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/** Stable sort. "date": dated notes first, oldest first, then by name; undated notes last by name. */
export function sortPackNotes(notes: readonly PackNote[], sort: PackSort): PackNote[] {
  const byName = (a: PackNote, b: PackNote): number =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
  const out = [...notes];
  if (sort === "name") return out.sort(byName);
  if (sort === "modified") return out.sort((a, b) => a.mtime - b.mtime || byName(a, b));
  return out.sort((a, b) => {
    const da = noteDate(a);
    const db = noteDate(b);
    if (da && db) return da.localeCompare(db) || byName(a, b);
    if (da) return -1;
    if (db) return 1;
    return byName(a, b);
  });
}

export interface DateFilterResult {
  kept: PackNote[];
  /** Notes left out because they have no date while a range is set. */
  undated: PackNote[];
}

/** Keep notes dated within [from, to] (inclusive, YYYY-MM-DD). With no range, keep everything. */
export function filterPackByDate(
  notes: readonly PackNote[],
  from: string | null,
  to: string | null,
): DateFilterResult {
  if (!from && !to) return { kept: [...notes], undated: [] };
  const kept: PackNote[] = [];
  const undated: PackNote[] = [];
  for (const n of notes) {
    const d = noteDate(n);
    if (d === null) undated.push(n);
    else if ((!from || d >= from) && (!to || d <= to)) kept.push(n);
  }
  return { kept, undated };
}

/** Earliest and latest note dates, for the cover page; null when no note has a date. */
export function packDateRange(notes: readonly PackNote[]): { from: string; to: string } | null {
  const dates = notes
    .map(noteDate)
    .filter((d): d is string => d !== null)
    .sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first && last ? { from: first, to: last } : null;
}

export type PackQuery = { ok: true; condition: MatcherCondition } | { ok: false; error: string };

/** "#tag" (or "tag:name") selects by tag; "property: value" selects by property. */
export function parsePackQuery(text: string): PackQuery {
  const t = text.trim();
  if (t === "") return { ok: false, error: "Enter a #tag or property: value." };
  const tag = /^(?:#|tag:\s*#?)(\S+)$/i.exec(t);
  if (tag?.[1]) return { ok: true, condition: { kind: "tag", tag: tag[1] } };
  const prop = /^([^:#\s][^:]*):\s*(.+)$/.exec(t);
  if (prop?.[1] && prop[2]) {
    return {
      ok: true,
      condition: { kind: "property", property: prop[1].trim(), equals: prop[2].trim() },
    };
  }
  return { ok: false, error: 'Use "#tag" or "property: value", for example "type: meeting".' };
}

/** Move an item by `delta` positions, clamped to the list. Returns a new list. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const out = [...list];
  const target = Math.max(0, Math.min(out.length - 1, index + delta));
  if (index < 0 || index >= out.length || target === index) return out;
  const [item] = out.splice(index, 1);
  out.splice(target, 0, item as T);
  return out;
}

/** The link path in an internal link's data-href: "Note#Heading" or "Note|Alias" -> "Note". */
export function linkpathOf(dataHref: string): string {
  return dataHref.split("|")[0]?.split("#")[0]?.trim() ?? "";
}

/** Anchor id for the n-th note (1-based) in the pack document. */
export function packAnchor(n: number): string {
  return `selective-print-note-${n}`;
}
