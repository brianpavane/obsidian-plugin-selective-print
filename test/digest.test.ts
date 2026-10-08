import { describe, expect, it } from "vitest";
import { DEFAULT_DIGEST_SECTIONS, digestSelection, parseDigestList } from "../src/core/digest";
import { defaultJobForNote } from "../src/core/note-job";
import { parseSections } from "../src/core/sections";
import { finalSelection, resolveDefaults } from "../src/core/selection";
import { loadFixture } from "./helpers";

const meeting = `## Meeting Summary
Summary.

## Decisions
- Go with option A

## Action items
- [ ] Alex: send recap

### Follow-ups
- [ ] Sam: book room

## Transcript
Speaker 1: hello
`;

function titles(md: string, ids: Set<string>): string[] {
  return parseSections(md)
    .all.filter((s) => ids.has(s.id))
    .map((s) => s.title);
}

describe("digestSelection", () => {
  const tree = parseSections(meeting);
  const defaults = finalSelection(
    resolveDefaults({ tree, globalExclude: ["Transcript"] }).defaults,
  );

  it("keeps only the named sections, with their subsections", () => {
    const r = digestSelection(tree, defaults, DEFAULT_DIGEST_SECTIONS);
    expect(titles(meeting, r.included)).toEqual(["Decisions", "Action items", "Follow-ups"]);
    expect(r.warnings).toEqual([]);
  });

  it("exclusions win: a digest cannot bring back an excluded Transcript", () => {
    expect(digestSelection(tree, defaults, ["Transcript"]).included.size).toBe(0);
  });

  it("matches case-insensitively and supports regex; reports bad entries", () => {
    expect(titles(meeting, digestSelection(tree, defaults, ["action ITEMS"]).included)).toEqual([
      "Action items",
      "Follow-ups",
    ]);
    expect(titles(meeting, digestSelection(tree, defaults, ["regex:^dec"]).included)).toEqual([
      "Decisions",
    ]);
    expect(digestSelection(tree, defaults, ["regex:(", "Decisions"]).warnings).toHaveLength(1);
  });

  it("returns nothing when no section matches", () => {
    expect(digestSelection(tree, defaults, ["Risks"]).included.size).toBe(0);
  });

  it.each([
    ["meeting-generated.md", ["Decisions", "Action items"]],
    ["meeting-new-format.md", ["Next Steps", "Key Decisions"]],
    ["meeting-mixed.md", ["Decisions", "Action items"]],
  ])("the default list picks up both meeting layouts: %s", (fixture, want) => {
    const md = loadFixture(fixture);
    const t = parseSections(md);
    const inc = finalSelection(
      resolveDefaults({ tree: t, globalExclude: ["Transcript"] }).defaults,
    );
    expect(titles(md, digestSelection(t, inc, DEFAULT_DIGEST_SECTIONS).included)).toEqual(want);
  });

  it("parses the settings text, one heading per line", () => {
    expect(parseDigestList(" Decisions \n\nAction items\r\nregex:^Next, steps{1,2}\n")).toEqual([
      "Decisions",
      "Action items",
      "regex:^Next, steps{1,2}",
    ]);
  });
});

describe("digest through defaultJobForNote", () => {
  const facts = { path: "M.md", title: "M", properties: { type: "meeting" }, tags: [] };

  it("prints only the digest sections, skipping empty ones", () => {
    const r = defaultJobForNote({
      tree: parseSections(loadFixture("meeting-generated.md")),
      note: facts,
      presets: [],
      globalExclude: ["Transcript"],
      settingsSkipEmpty: true,
      includeTitle: false,
      digest: DEFAULT_DIGEST_SECTIONS,
    });
    // The fixture's Decisions section holds only an empty checkbox, so it is skipped.
    expect(r.job.markdown).toBe("## Action items\n- [ ] Alex Example: send the recap\n\n");
  });

  it("a note without any digest section yields empty output", () => {
    const r = defaultJobForNote({
      tree: parseSections("## Notes\ntext\n"),
      note: facts,
      presets: [],
      globalExclude: [],
      settingsSkipEmpty: true,
      includeTitle: false,
      digest: DEFAULT_DIGEST_SECTIONS,
    });
    expect(r.job.markdown.trim()).toBe("");
  });

  it("reports invalid digest entries", () => {
    const r = defaultJobForNote({
      tree: parseSections(meeting),
      note: facts,
      presets: [],
      globalExclude: [],
      settingsSkipEmpty: true,
      digest: ["regex:("],
    });
    expect(r.warnings[0]).toMatch(/^digest: /);
  });
});
