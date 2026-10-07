import { describe, expect, it } from "vitest";
import {
  applySelection,
  filterNote,
  filterProperties,
  removeCallouts,
  removeExcludeMarkers,
  skipEmptySections,
} from "../src/core/filter";
import { parseSections } from "../src/core/sections";
import { finalSelection, resolveDefaults } from "../src/core/selection";
import { loadFixture } from "./helpers";

function headings(md: string): string[] {
  return parseSections(md, { frontmatter: false })
    .all.filter((s) => s.level > 0)
    .map((s) => s.title);
}

describe("applySelection", () => {
  const src = loadFixture("transcript-nested.md");
  const tree = parseSections(src);
  const ids = (titles: string[]) =>
    new Set(tree.all.filter((s) => titles.includes(s.title)).map((s) => s.id));

  it("with everything included, reproduces the body", () => {
    expect(applySelection(tree, new Set(tree.all.map((s) => s.id)))).toBe(src);
  });

  it("drops one section and keeps the rest exactly", () => {
    const out = applySelection(tree, ids(["Summary", "Transcript", "Part 1", "Part 2"]));
    expect(headings(out)).toEqual(["Summary", "Transcript", "Part 1", "Part 2"]);
    expect(out).not.toContain("Content after the transcript.");
  });

  it("drops a parent with its children", () => {
    const out = applySelection(tree, ids(["Summary", "After"]));
    expect(out).toBe("## Summary\nSummary text.\n\n## After\nContent after the transcript.\n");
  });

  it("keeps a re-checked child of an excluded parent without the parent heading", () => {
    const out = applySelection(tree, ids(["Part 2"]));
    expect(out).toBe("### Part 2\nSpeaker 2: Second part.\n\n");
  });

  it("can exclude everything", () => {
    expect(applySelection(tree, new Set())).toBe("");
  });
});

describe("removeExcludeMarkers", () => {
  const { text, warnings } = removeExcludeMarkers(loadFixture("exclude-markers.md"));

  it("removes balanced blocks and inline regions", () => {
    expect(text).toContain("Keep before.\nKeep after.\n");
    expect(text).not.toContain("Hidden block line.");
    expect(text).toContain("Inline  text.\n");
    expect(text).not.toContain("secret");
  });

  it("handles nesting", () => {
    expect(text).not.toMatch(/Outer hidden|Inner hidden|Still hidden/);
    expect(text).toContain("## Nested\nVisible after nested.\n");
  });

  it("leaves markers inside code fences alone", () => {
    expect(text).toContain("```\n%% print:exclude %%\nLiteral marker in code stays.\n```\n");
  });

  it("excludes an unmatched start to the end of its section and warns", () => {
    expect(text).toContain("## Unmatched start\nVisible.\n## Next section\nVisible again.\n");
    expect(text).not.toContain("Hidden to end of section.");
  });

  it("removes a stray end marker and warns", () => {
    expect(text).toContain("Stray  end marker.");
    expect(warnings.map((w) => [w.code, w.line])).toEqual([
      ["unmatched-marker-start", 27],
      ["unmatched-marker-end", 32],
    ]);
  });

  it("warns for a start marker still open at the end of the note", () => {
    const r = removeExcludeMarkers("a\n%% print:exclude %%\nhidden\n");
    expect(r.text).toBe("a\n");
    expect(r.warnings.map((w) => w.code)).toEqual(["unmatched-marker-start"]);
  });

  it("keeps text before a marker on the same line", () => {
    const r = removeExcludeMarkers(
      "keep %% print:exclude %% drop\nalso drop\n%% /print:exclude %% tail",
    );
    expect(r.text).toBe("keep \n tail");
  });
});

describe("removeCallouts", () => {
  const src = loadFixture("callouts.md");

  it("removes listed types with nested content, case-insensitively", () => {
    const out = removeCallouts(src, ["Private", "internal"]);
    expect(out).not.toMatch(
      /Only for me|Nested quote inside private|Also hidden|Hidden nested content/,
    );
    expect(out).toContain("> [!note]- Foldable note\n> Keep this note.\n> Back in the note.\n");
    expect(out).toContain("Visible paragraph.");
    expect(out).toContain("After callouts.");
  });

  it("leaves callouts inside code fences", () => {
    expect(removeCallouts(src, ["private"])).toContain(
      "> [!private] In a code fence\n> Must stay.\n",
    );
  });

  it("is a no-op with no types", () => {
    expect(removeCallouts(src, [])).toBe(src);
  });
});

describe("skipEmptySections", () => {
  it("drops empty sections and parents whose children are all empty", () => {
    const { text, skipped } = skipEmptySections(loadFixture("empty-sections.md"));
    expect(headings(text)).toEqual([
      "Real content",
      "Parent with empty own content",
      "Child with content",
    ]);
    expect(skipped).toBe(6);
  });

  it("drops a whitespace-only preamble", () => {
    expect(skipEmptySections("\n\n## A\ntext\n").text).toBe("## A\ntext\n");
  });
});

describe("filterProperties", () => {
  const props = { type: "meeting", Attendees: ["Alex Example"], date: "2026-10-07" };
  it("none / all / except", () => {
    expect(filterProperties(props, "none")).toEqual({});
    expect(filterProperties(props, "all")).toEqual(props);
    expect(filterProperties(props, "except", ["attendees", " DATE "])).toEqual({ type: "meeting" });
  });
});

describe("filterNote pipeline", () => {
  it("meeting fixture: Transcript excluded, empty placeholders skipped (M1 acceptance)", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const { defaults } = resolveDefaults({ tree, globalExclude: ["Transcript"] });
    const result = filterNote(tree, {
      included: finalSelection(defaults),
      inlineMarkers: true,
      excludeCalloutTypes: [],
      skipEmpty: true,
      properties: {
        values: { type: "meeting", attendees: ["Alex Example"] },
        mode: "except",
        list: ["attendees"],
      },
    });
    expect(headings(result.body)).toEqual(["Meeting Summary", "Agenda", "Action items"]);
    expect(result.body).not.toContain("Speaker 1");
    expect(result.body).not.toContain("type: meeting"); // frontmatter is never in the body
    expect(result.stats).toEqual({ included: 3, excluded: 1, emptySkipped: 2 });
    expect(result.properties).toEqual({ type: "meeting" });
    expect(result.warnings).toEqual([]);
  });

  it("checking Transcript in the dialog includes it", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const { defaults } = resolveDefaults({ tree, globalExclude: ["Transcript"] });
    const transcript = tree.all.find((s) => s.title === "Transcript");
    if (!transcript) throw new Error("fixture");
    const result = filterNote(tree, {
      included: finalSelection(defaults, new Map([[transcript.id, true]])),
      inlineMarkers: false,
      excludeCalloutTypes: [],
      skipEmpty: false,
    });
    expect(result.body).toContain("Speaker 1: Welcome, everyone.");
    expect(result.stats).toEqual({ included: 6, excluded: 0, emptySkipped: 0 });
    expect(result.properties).toBeUndefined();
  });

  it("applies markers and callouts, and reports marker warnings", () => {
    const src = "## A\n> [!private]\n> x\n%% print:exclude %%\nopen\n## B\nb\n";
    const tree = parseSections(src);
    const result = filterNote(tree, {
      included: new Set(tree.all.map((s) => s.id)),
      inlineMarkers: true,
      excludeCalloutTypes: ["private"],
      skipEmpty: true,
    });
    expect(result.body).toBe("## B\nb\n");
    expect(result.stats.emptySkipped).toBe(1);
    expect(result.warnings.map((w) => w.code)).toEqual(["unmatched-marker-start"]);
  });

  it("filters a 10k+ line transcript note quickly", () => {
    const transcript = Array.from({ length: 12000 }, (_, i) => `Speaker ${i % 3}: line ${i}.`).join(
      "\n",
    );
    const tree = parseSections(`## Summary\nShort.\n\n## Transcript\n${transcript}\n`);
    const { defaults } = resolveDefaults({ tree, globalExclude: ["Transcript"] });
    const start = performance.now();
    const result = filterNote(tree, {
      included: finalSelection(defaults),
      inlineMarkers: true,
      excludeCalloutTypes: ["private"],
      skipEmpty: true,
    });
    expect(performance.now() - start).toBeLessThan(500);
    expect(result.body).toBe("## Summary\nShort.\n\n");
  });
});
