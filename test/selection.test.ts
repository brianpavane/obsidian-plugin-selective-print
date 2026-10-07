import { describe, expect, it } from "vitest";
import { parseSections } from "../src/core/sections";
import {
  compileRules,
  finalSelection,
  findMissingHeadings,
  resolveDefaults,
  validateRuleEntry,
  type ResolveInput,
} from "../src/core/selection";
import type { SectionDefault, SectionTree } from "../src/core/types";
import { loadFixture } from "./helpers";

const GLOBAL = ["Transcript"];

function resolve(fixture: string, extra: Partial<ResolveInput> = {}) {
  const tree = parseSections(loadFixture(fixture));
  const result = resolveDefaults({ tree, globalExclude: GLOBAL, ...extra });
  return { tree, ...result };
}

function excludedTitles(tree: SectionTree, defaults: SectionDefault[]): string[] {
  return defaults
    .filter((d) => d.excluded)
    .map((d) => tree.all.find((s) => s.id === d.id)?.title ?? "?");
}

function stateOf(tree: SectionTree, defaults: SectionDefault[], title: string): SectionDefault {
  const s = tree.all.find((x) => x.title === title);
  const d = defaults.find((x) => x.id === s?.id);
  if (!d) throw new Error(`no section "${title}"`);
  return d;
}

describe("global exclude list", () => {
  it("excludes Transcript by default and nothing else", () => {
    const { tree, defaults, warnings } = resolve("transcript-present.md");
    expect(excludedTitles(tree, defaults)).toEqual(["Transcript"]);
    expect(stateOf(tree, defaults, "Transcript")).toMatchObject({
      source: "global",
      viaAncestor: false,
    });
    expect(stateOf(tree, defaults, "Meeting Summary")).toMatchObject({
      excluded: false,
      source: null,
    });
    expect(warnings).toEqual([]);
  });

  it("leaves a note without Transcript untouched and never warns", () => {
    const { tree, defaults, warnings } = resolve("transcript-absent.md");
    expect(excludedTitles(tree, defaults)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("takes nested subheadings with the excluded section", () => {
    const { tree, defaults } = resolve("transcript-nested.md");
    expect(excludedTitles(tree, defaults)).toEqual(["Transcript", "Part 1", "Part 2"]);
    expect(stateOf(tree, defaults, "Part 1")).toMatchObject({
      source: "global",
      viaAncestor: true,
    });
    expect(stateOf(tree, defaults, "After").excluded).toBe(false);
  });

  it("excludes every occurrence of a duplicated heading", () => {
    const { tree, defaults } = resolve("transcript-duplicated.md");
    expect(excludedTitles(tree, defaults)).toEqual(["Transcript", "Transcript"]);
  });

  it("matches case-insensitively and trimmed at any level, but not longer names", () => {
    const { tree, defaults } = resolve("transcript-case.md");
    expect(excludedTitles(tree, defaults)).toEqual(["transcript", "TRANSCRIPT", "Transcript"]);
  });

  it("supports regex: entries (case-insensitive)", () => {
    const { tree, defaults } = resolve("transcript-case.md", {
      globalExclude: ["regex:transcript$"],
    });
    expect(excludedTitles(tree, defaults)).toEqual([
      "transcript",
      "TRANSCRIPT",
      "Transcript",
      "Raw Transcript",
    ]);
  });

  it("matches the plain text of headings with links or emphasis", () => {
    const tree = parseSections("## [[Transcript]]\nx\n## **Transcript**\ny\n");
    const { defaults } = resolveDefaults({ tree, globalExclude: GLOBAL });
    expect(defaults.every((d) => d.excluded)).toBe(true);
  });

  it("never matches the Preamble pseudo-section", () => {
    const tree = parseSections(loadFixture("preamble.md"));
    const { defaults } = resolveDefaults({ tree, globalExclude: ["Preamble", "regex:.*"] });
    expect(defaults[0]).toMatchObject({ id: "0:Preamble#1", excluded: false });
    expect(defaults[1]?.excluded).toBe(true);
  });

  it("reports invalid entries and skips them", () => {
    const { tree, defaults, warnings } = resolve("transcript-present.md", {
      globalExclude: ["regex:([bad", "  ", "Transcript"],
    });
    expect(excludedTitles(tree, defaults)).toEqual(["Transcript"]);
    expect(warnings.map((w) => w.code)).toEqual(["invalid-rule", "invalid-rule"]);
  });
});

describe("precedence: dialog > note > preset+global > global > none", () => {
  it("note print-exclude replaces preset and global exclusions", () => {
    const { tree, defaults } = resolve("transcript-present.md", {
      preset: { exclude: ["Action items"], inheritGlobal: true },
      noteExclude: ["Meeting Summary"],
    });
    expect(excludedTitles(tree, defaults)).toEqual(["Meeting Summary"]);
    expect(stateOf(tree, defaults, "Meeting Summary").source).toBe("note");
  });

  it("an empty note print-exclude includes everything", () => {
    const { defaults } = resolve("transcript-present.md", { noteExclude: [] });
    expect(defaults.some((d) => d.excluded)).toBe(false);
  });

  it("a preset unions its list with the global list by default", () => {
    const { tree, defaults } = resolve("transcript-present.md", {
      preset: { exclude: ["Action items"], inheritGlobal: true },
    });
    expect(excludedTitles(tree, defaults)).toEqual(["Transcript", "Action items"]);
    expect(stateOf(tree, defaults, "Action items").source).toBe("preset");
    expect(stateOf(tree, defaults, "Transcript").source).toBe("global");
  });

  it("tags a heading named by both preset and global as preset", () => {
    const { tree, defaults } = resolve("transcript-present.md", {
      preset: { exclude: ["transcript"], inheritGlobal: true },
    });
    expect(stateOf(tree, defaults, "Transcript").source).toBe("preset");
  });

  it("inherit-global: false replaces the global list", () => {
    const { tree, defaults } = resolve("transcript-present.md", {
      preset: { exclude: [], inheritGlobal: false },
    });
    expect(excludedTitles(tree, defaults)).toEqual([]);
  });

  it("with no rules at all, everything is included", () => {
    const { defaults } = resolve("transcript-present.md", { globalExclude: [] });
    expect(defaults.some((d) => d.excluded)).toBe(false);
  });

  it("dialog overrides win over every default, per section id", () => {
    const { tree, defaults } = resolve("transcript-nested.md");
    const part2 = tree.all.find((s) => s.title === "Part 2");
    const summary = tree.all.find((s) => s.title === "Summary");
    if (!part2 || !summary) throw new Error("fixture");
    const included = finalSelection(
      defaults,
      new Map([
        [part2.id, true],
        [summary.id, false],
      ]),
    );
    const titles = tree.all.filter((s) => included.has(s.id)).map((s) => s.title);
    expect(titles).toEqual(["Part 2", "After"]);
  });

  it("without overrides, the selection equals the defaults", () => {
    const { tree, defaults } = resolve("transcript-present.md");
    const included = finalSelection(defaults);
    expect(tree.all.filter((s) => included.has(s.id)).map((s) => s.title)).toEqual([
      "Meeting Summary",
      "Action items",
    ]);
  });
});

describe("drift detection (presets only)", () => {
  const recap = ["Agenda", "Notes", "Decisions", "regex:^Appendix"];

  it("reports preset headings missing from the note", () => {
    const tree = parseSections(loadFixture("meeting-drift-missing.md"));
    expect(findMissingHeadings(tree, recap).map((w) => w.message)).toEqual([
      "not found: Notes",
      "not found: Decisions",
      "not found: regex:^Appendix",
    ]);
  });

  it("reports renamed headings", () => {
    const tree = parseSections(loadFixture("meeting-drift-renamed.md"));
    expect(
      findMissingHeadings(tree, ["Meeting Summary", "Agenda", "Transcript"]).map((w) => w.message),
    ).toEqual(["not found: Meeting Summary", "not found: Agenda"]);
  });

  it("reports nothing when every heading exists", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    expect(findMissingHeadings(tree, ["Agenda", "Notes", "Decisions"])).toEqual([]);
  });
});

describe("rule validation", () => {
  it("validates entries", () => {
    expect(validateRuleEntry("Transcript")).toBeNull();
    expect(validateRuleEntry("regex:^A")).toBeNull();
    expect(validateRuleEntry("REGEX:^A")).toBeNull();
    expect(validateRuleEntry("")).toBe("empty heading name");
    expect(validateRuleEntry("regex:")).toBe("empty regular expression");
    expect(validateRuleEntry("regex:(")).toMatch(/^invalid regular expression/);
  });

  it("compiles only valid rules", () => {
    const { rules, errors } = compileRules(["A", "regex:(", "regex:^b"]);
    expect(rules.map((r) => r.entry)).toEqual(["A", "regex:^b"]);
    expect(errors).toHaveLength(1);
  });
});
