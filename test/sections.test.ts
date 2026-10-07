import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  isEmptyContent,
  parseSections,
  plainHeadingText,
  splitFrontmatter,
  splitLines,
} from "../src/core/sections";
import type { SectionTree } from "../src/core/types";
import { loadFixture } from "./helpers";

function titles(tree: SectionTree): string[] {
  return tree.all.map((s) => s.title);
}

function byTitle(tree: SectionTree, title: string) {
  const s = tree.all.find((x) => x.title === title);
  if (!s) throw new Error(`no section "${title}"`);
  return s;
}

/** Round-trip invariant: frontmatter + every own slice reproduces the source. */
function roundTrip(tree: SectionTree): string {
  const fm = tree.frontmatter ?? "";
  return fm + tree.all.map((s) => tree.lines.slice(s.startLine, s.ownEndLine).join("")).join("");
}

describe("splitLines / splitFrontmatter", () => {
  it("keeps terminators so join reproduces the text", () => {
    for (const t of ["", "a", "a\n", "a\r\nb", "\n\n", "x\ny\n"]) {
      expect(splitLines(t).join("")).toBe(t);
    }
  });

  it("splits frontmatter only when it is closed", () => {
    expect(splitFrontmatter("---\na: 1\n---\nbody").frontmatter).toBe("---\na: 1\n---\n");
    expect(splitFrontmatter("---\na: 1\n---\nbody").body).toBe("body");
    expect(splitFrontmatter("---\na: 1\nno close").frontmatter).toBeNull();
    expect(splitFrontmatter("text\n---\n").frontmatter).toBeNull();
    expect(splitFrontmatter("---\na: 1\n...\nbody").body).toBe("body");
  });
});

describe("parseSections: structure", () => {
  it("nests H1/H2/H3 and computes ranges", () => {
    const tree = parseSections(loadFixture("nesting.md"));
    expect(tree.roots.map((s) => s.title)).toEqual(["Project Overview", "Appendix"]);
    const overview = byTitle(tree, "Project Overview");
    expect(overview.children.map((s) => s.title)).toEqual(["Goals", "Risks"]);
    expect(byTitle(tree, "Goals").children.map((s) => s.title)).toEqual(["Stretch goals"]);
    expect(overview.startLine).toBe(0);
    expect(overview.ownEndLine).toBe(3);
    expect(overview.endLine).toBe(byTitle(tree, "Appendix").startLine);
    expect(byTitle(tree, "Appendix").endLine).toBe(tree.lines.length);
    expect(tree.preamble).toBeNull();
  });

  it("handles frontmatter with Properties-style YAML", () => {
    const tree = parseSections(loadFixture("frontmatter-properties.md"));
    expect(tree.frontmatter).toContain("attendees:");
    expect(tree.bodyStartLine).toBe(11);
    expect(tree.preamble?.startLine).toBe(11);
    expect(titles(tree)).toEqual(["Preamble", "Notes"]);
  });

  it("gives duplicate headings distinct, stable ids", () => {
    const tree = parseSections(loadFixture("duplicate-headings.md"));
    expect(tree.all.map((s) => s.id)).toEqual([
      "2:Notes#1",
      "2:Decisions#1",
      "2:Notes#2",
      "3:Notes#1",
    ]);
  });

  it("ignores headings inside code fences and comments", () => {
    const tree = parseSections(loadFixture("fenced-headings.md"));
    expect(titles(tree)).toEqual(["Real heading", "Second real heading"]);
  });

  it("parses setext headings, closing hashes, links, emphasis and emoji", () => {
    const tree = parseSections(loadFixture("setext-trailing.md"));
    expect(titles(tree)).toEqual([
      "Setext Title",
      "Setext Section",
      "Closed ATX",
      "C# Tips",
      "[[Decisions]] and [Links](https://example.com)",
      "**Bold** _italic_ `code` heading",
      "🚀 Launch plan",
    ]);
    expect(byTitle(tree, "Setext Title").level).toBe(1);
    expect(byTitle(tree, "Setext Section").level).toBe(2);
    expect(byTitle(tree, "Setext Title").headingEndLine).toBe(2);
    expect(byTitle(tree, "[[Decisions]] and [Links](https://example.com)").plainTitle).toBe(
      "Decisions and Links",
    );
    expect(byTitle(tree, "**Bold** _italic_ `code` heading").plainTitle).toBe(
      "Bold italic code heading",
    );
  });

  it("captures the preamble before the first heading", () => {
    const tree = parseSections(loadFixture("preamble.md"));
    expect(tree.preamble).toMatchObject({
      id: "0:Preamble#1",
      level: 0,
      startLine: 0,
      ownEndLine: 3,
    });
    expect(tree.preamble?.isEmpty).toBe(false);
  });

  it("handles a note with no headings and an empty note", () => {
    const only = parseSections("just text\n");
    expect(only.all).toHaveLength(1);
    expect(only.preamble?.ownEndLine).toBe(1);
    const empty = parseSections("");
    expect(empty.all).toEqual([]);
  });

  it("supports a multi-line setext paragraph and ignores = without a paragraph", () => {
    const tree = parseSections("Line one\nline two\n===\n\n===\n");
    expect(titles(tree)).toEqual(["Line one line two"]);
  });

  it("treats a line after a list as lazy continuation, not a setext paragraph", () => {
    const tree = parseSections("- item\ncontinued\n---\n");
    expect(tree.all.filter((s) => s.level > 0)).toHaveLength(0);
  });

  it("skips frontmatter detection when asked", () => {
    const tree = parseSections("---\nnot: frontmatter\n---\n", { frontmatter: false });
    expect(tree.frontmatter).toBeNull();
    // The opening "---" is a thematic break in the preamble; the next lines form a setext H2.
    expect(titles(tree)).toEqual(["Preamble", "not: frontmatter"]);
  });

  it("handles CRLF line endings", () => {
    const src = "## A\r\nbody\r\n## B\r\nmore\r\n";
    const tree = parseSections(src);
    expect(titles(tree)).toEqual(["A", "B"]);
    expect(roundTrip(tree)).toBe(src);
  });
});

describe("emptiness and size hints", () => {
  it("treats placeholder bullets, empty tasks, comments and blanks as empty", () => {
    const tree = parseSections(loadFixture("empty-sections.md"));
    const empty = Object.fromEntries(tree.all.map((s) => [s.title, s.isEmpty]));
    expect(empty).toEqual({
      "Empty bullets": true,
      "Empty tasks": true,
      "Only comments": true,
      "Only blank lines": true,
      "Real content": false,
      "Parent with empty own content": false,
      "Child with content": false,
      "Parent with only empty children": true,
      "Empty child": true,
    });
  });

  it("isEmptyContent handles numbered markers and multi-line comments", () => {
    expect(isEmptyContent(["1.\n", "2)\n", "<!--\nmulti\n-->\n"])).toBe(true);
    expect(isEmptyContent(["- [x]\n"])).toBe(true);
    expect(isEmptyContent(["- [ ] text\n"])).toBe(false);
    expect(isEmptyContent(["---\n"])).toBe(false);
  });

  it("counts words and lines in the subtree, excluding the own heading", () => {
    const tree = parseSections(loadFixture("transcript-nested.md"));
    const t = byTitle(tree, "Transcript");
    expect(t.lineCount).toBe(t.endLine - t.headingEndLine);
    expect(t.wordCount).toBe(18);
  });
});

describe("plainHeadingText", () => {
  it("strips Markdown syntax but keeps snake_case words", () => {
    expect(plainHeadingText("[[Note|Alias]]")).toBe("Alias");
    expect(plainHeadingText("~~old~~ ==new==")).toBe("old new");
    expect(plainHeadingText("my_var_name")).toBe("my_var_name");
  });
});

describe("round-trip invariant", () => {
  const fixtures = [
    "nesting.md",
    "frontmatter-properties.md",
    "duplicate-headings.md",
    "fenced-headings.md",
    "setext-trailing.md",
    "preamble.md",
    "empty-sections.md",
    "callouts.md",
    "exclude-markers.md",
    "meeting-generated.md",
  ];
  it.each(fixtures)("%s", (name) => {
    const src = loadFixture(name);
    expect(roundTrip(parseSections(src))).toBe(src);
  });

  it("holds for arbitrary Markdown-like input (property test)", () => {
    const line = fc.oneof(
      fc.constantFrom(
        "# H1",
        "## H2",
        "### H3 ###",
        "Para",
        "===",
        "---",
        "```",
        "~~~",
        "- item",
        "- [ ]",
        "> [!note]",
        "<!--",
        "-->",
        "%%",
        "",
        "   ",
        "\t## tab",
      ),
      fc.string({ maxLength: 12 }),
    );
    const doc = fc
      .tuple(fc.array(line, { maxLength: 40 }), fc.constantFrom("\n", "\r\n"), fc.boolean())
      .map(([ls, eol, trailing]) => ls.join(eol) + (trailing ? eol : ""));
    fc.assert(
      fc.property(doc, (src) => {
        const tree = parseSections(src);
        expect(roundTrip(tree)).toBe(src);
        // Ranges are well-formed and nested.
        for (const s of tree.all) {
          expect(s.startLine).toBeLessThanOrEqual(s.headingEndLine);
          expect(s.headingEndLine).toBeLessThanOrEqual(s.ownEndLine);
          expect(s.ownEndLine).toBeLessThanOrEqual(s.endLine);
          for (const c of s.children) {
            expect(c.level).toBeGreaterThan(s.level);
            expect(c.endLine).toBeLessThanOrEqual(s.endLine);
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("performance", () => {
  it("parses a 10k+ line transcript quickly", () => {
    const transcript = Array.from(
      { length: 12000 },
      (_, i) => `Speaker ${i % 3}: line ${i} of the call.`,
    );
    const src = `## Summary\nShort.\n\n## Transcript\n${transcript.join("\n")}\n\n## After\nDone.\n`;
    const start = performance.now();
    const tree = parseSections(src);
    const ms = performance.now() - start;
    expect(titles(tree)).toEqual(["Summary", "Transcript", "After"]);
    expect(byTitle(tree, "Transcript").lineCount).toBeGreaterThan(12000);
    expect(ms).toBeLessThan(500);
  });
});
