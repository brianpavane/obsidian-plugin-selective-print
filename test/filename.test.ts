import { describe, expect, it } from "vitest";
import {
  FALLBACK_FILENAME,
  MAX_FILENAME_LENGTH,
  renderFilename,
  sanitizeFilename,
  uniqueFilename,
  type FilenameContext,
} from "../src/core/filename";

const now = new Date(2026, 9, 7, 9, 5); // 2026-10-07 09:05 local
const ctx = (over: Partial<FilenameContext> = {}): FilenameContext => ({
  title: "Weekly Sync",
  properties: {},
  now,
  ...over,
});

describe("renderFilename", () => {
  it("default template uses today when the note has no date", () => {
    expect(renderFilename("{date} - {title}", ctx())).toEqual({
      name: "2026-10-07 - Weekly Sync",
      warnings: [],
    });
  });

  it("prefers the note's date property (string or Date)", () => {
    expect(renderFilename("{date}", ctx({ properties: { date: "2026-01-31" } })).name).toBe(
      "2026-01-31",
    );
    expect(renderFilename("{date}", ctx({ properties: { Date: "2026-01-31T10:00" } })).name).toBe(
      "2026-01-31",
    );
    expect(
      renderFilename("{date}", ctx({ properties: { date: new Date("2026-02-03") } })).name,
    ).toBe("2026-02-03");
  });

  it("ignores an invalid date property", () => {
    expect(renderFilename("{date}", ctx({ properties: { date: "2026-02-30" } })).name).toBe(
      "2026-10-07",
    );
    expect(renderFilename("{date}", ctx({ properties: { date: "soon" } })).name).toBe("2026-10-07");
    expect(renderFilename("{date}", ctx({ properties: { date: new Date("nope") } })).name).toBe(
      "2026-10-07",
    );
  });

  it("renders datetime without colons, preset and frontmatter values", () => {
    const r = renderFilename(
      "{datetime} {preset} {frontmatter.client} {frontmatter.tags} {frontmatter.n}",
      {
        ...ctx({ preset: "Meeting recap" }),
        properties: { Client: "Contoso", tags: ["a", "b"], n: 3 },
      },
    );
    expect(r).toEqual({ name: "2026-10-07 0905 Meeting recap Contoso a, b 3", warnings: [] });
  });

  it("warns about missing and unknown variables and removes them", () => {
    const r = renderFilename("{title} {preset} {frontmatter.missing} {frontmatter.obj} {nope}", {
      ...ctx(),
      properties: { obj: { a: 1 } },
    });
    expect(r.name).toBe("Weekly Sync");
    expect(r.warnings.map((w) => w.message)).toEqual([
      "{preset} is empty: no preset is active",
      '{frontmatter.missing} is empty: the note has no "missing" property',
      '{frontmatter.obj} is empty: the note has no "obj" property',
      "unknown variable {nope} removed",
    ]);
  });

  it("formats a Date frontmatter value as a date", () => {
    expect(
      renderFilename("{frontmatter.due}", ctx({ properties: { due: new Date("2026-03-04") } }))
        .name,
    ).toBe("2026-03-04");
    expect(
      renderFilename("{frontmatter.e} x", ctx({ properties: { e: [] } })).warnings,
    ).toHaveLength(1);
  });

  it("sanitizes the result and falls back when empty", () => {
    expect(renderFilename("{title}", ctx({ title: "Q3: Plan / Review" })).name).toBe(
      "Q3 Plan Review",
    );
    const empty = renderFilename("{frontmatter.x}", ctx());
    expect(empty.name).toBe(FALLBACK_FILENAME);
    expect(empty.warnings.map((w) => w.message)).toContain(
      `template produced an empty name; using "${FALLBACK_FILENAME}"`,
    );
  });
});

describe("sanitizeFilename", () => {
  it("strips characters illegal on macOS or in Obsidian names", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij");
  });

  it("collapses whitespace, removes control characters, leading dots and stray separators", () => {
    expect(sanitizeFilename("  ..hidden   name\t\n  ")).toBe("hidden name");
    expect(sanitizeFilename("a\u0000b\u001fc")).toBe("a b c");
    expect(sanitizeFilename("- title -")).toBe("title");
    expect(sanitizeFilename("name...")).toBe("name");
  });

  it("caps long names without splitting characters", () => {
    const long = "🚀".repeat(200);
    const out = sanitizeFilename(long);
    expect(Array.from(out)).toHaveLength(MAX_FILENAME_LENGTH);
    expect(out).toBe("🚀".repeat(MAX_FILENAME_LENGTH));
    expect(sanitizeFilename("abc def", 4)).toBe("abc");
  });

  it("returns the fallback for an empty result", () => {
    expect(sanitizeFilename("///")).toBe(FALLBACK_FILENAME);
    expect(sanitizeFilename("", 10, "X")).toBe("X");
  });
});

describe("uniqueFilename", () => {
  it("appends (2), (3) ... and never returns an existing name", () => {
    const existing = new Set(["Note.pdf", "Note (2).pdf"]);
    expect(uniqueFilename("Note", "pdf", (n) => existing.has(n))).toBe("Note (3).pdf");
    expect(uniqueFilename("Other", ".pdf", (n) => existing.has(n))).toBe("Other.pdf");
  });
});
