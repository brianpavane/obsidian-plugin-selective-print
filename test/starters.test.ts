import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  defaultPreset,
  matchPresets,
  orderForDropdown,
  validatePresetSet,
} from "../src/core/presets";
import { parseSections, splitFrontmatter } from "../src/core/sections";
import { finalSelection, findMissingHeadings, resolveDefaults } from "../src/core/selection";
import {
  compareCopy,
  installedAfter,
  joinPath,
  planStarterSync,
  starterHash,
  type StarterDef,
} from "../src/core/starters-plan";
import { STARTERS } from "../src/starters";
import { loadFixture } from "./helpers";

function frontmatterOf(content: string): unknown {
  const fm = splitFrontmatter(content).frontmatter ?? "";
  return parse(fm.replace(/^---\n/, "").replace(/---\n?$/, "")) as unknown;
}

const loaded = validatePresetSet(
  STARTERS.map((s) => ({ file: `Print Presets/${s.file}`, frontmatter: frontmatterOf(s.content) })),
);

describe("bundled starters", () => {
  it("all validate with no errors or warnings, and names match", () => {
    expect(loaded.errors).toEqual([]);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.presets.map((p) => p.name).sort()).toEqual(STARTERS.map((s) => s.name).sort());
    for (const s of STARTERS) {
      const p = loaded.presets.find((x) => x.name === s.name);
      expect(p?.starterVersion).toBe(s.version);
      expect(s.content).toMatch(
        /<!-- verified against (README, not against live notes|live notes by Brian, 2026-10-07) -->/,
      );
    }
  });

  it("meeting starters are verified against live notes (v2) and upgrade unmodified v1 copies", () => {
    for (const name of ["Meeting notes", "Meeting recap", "Meeting full (with transcript)"]) {
      const s = STARTERS.find((x) => x.name === name);
      expect(s?.version).toBe(2);
      expect(s?.content).toContain("<!-- verified against live notes by Brian, 2026-10-07 -->");
      expect(s?.shippedHashes).toHaveLength(2);
      const v1 = s?.content
        .replace("starter-version: 2", "starter-version: 1")
        .replace(
          "<!-- verified against live notes by Brian, 2026-10-07 -->",
          "<!-- verified against README, not against live notes -->",
        );
      expect(s?.shippedHashes[0]).toBe(starterHash(v1 ?? ""));
    }
    for (const name of ["Meeting tracker", "Weekly review"]) {
      expect(STARTERS.find((x) => x.name === name)?.content).toContain("verified against README");
    }
  });

  it("the bundled file on disk equals the bundled string", () => {
    for (const s of STARTERS) {
      expect(readFileSync(join(import.meta.dirname, "..", "starters", s.file), "utf8")).toBe(
        s.content,
      );
    }
  });

  it("a meeting note gets 'Meeting notes' by default, with Transcript excluded", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const match = matchPresets(loaded.presets, {
      path: "Meetings/Sync.md",
      properties: { type: "meeting" },
      tags: [],
    });
    const chosen = defaultPreset(match);
    expect(chosen.name).toBe("Meeting notes");
    const included = finalSelection(
      resolveDefaults({ tree, globalExclude: ["Transcript"], preset: chosen.sections }).defaults,
    );
    const titles = tree.all.filter((s) => included.has(s.id)).map((s) => s.title);
    expect(titles).not.toContain("Transcript");
    expect(
      orderForDropdown(loaded.presets, match)
        .map((p) => p.name)
        .slice(0, 3),
    ).toEqual(["Meeting notes", "Meeting full (with transcript)", "Meeting recap"]);
  });

  it("Meeting recap names headings that exist in the generated note (no drift)", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const recap = loaded.presets.find((p) => p.name === "Meeting recap");
    expect(findMissingHeadings(tree, recap?.sections.exclude ?? [])).toEqual([]);
  });

  it("tracker and weekly review match by filename and folder", () => {
    const tracker = matchPresets(loaded.presets, {
      path: "Meeting Tracker 2026.md",
      properties: {},
      tags: [],
    });
    expect(defaultPreset(tracker).name).toBe("Meeting tracker");
    const weekly = matchPresets(loaded.presets, {
      path: "Weekly Reviews/2026-W41.md",
      properties: {},
      tags: [],
    });
    expect(defaultPreset(weekly).name).toBe("Weekly review");
  });
});

const v1 = "---\nname: Demo\nstarter-version: 1\n---\nv1\n";
const v2 = "---\nname: Demo\nstarter-version: 2\n---\nv2\n";
const demo: StarterDef = {
  name: "Demo",
  file: "Demo.md",
  version: 2,
  content: v2,
  shippedHashes: [starterHash(v1), starterHash(v2)],
};

function plan(
  files: Record<string, string>,
  installed: Record<string, number>,
  mode: "auto" | "manual",
) {
  return planStarterSync({
    starters: [demo],
    folder: "Print Presets",
    read: (p) => files[p] ?? null,
    installed,
    mode,
  });
}

describe("planStarterSync", () => {
  it("first run creates", () => {
    const a = plan({}, {}, "auto");
    expect(a.map((x) => [x.kind, x.path])).toEqual([["create", "Print Presets/Demo.md"]]);
    expect(installedAfter({}, a)).toEqual({ Demo: 2 });
  });

  it("a deleted starter is not re-created automatically, but is by a manual refresh", () => {
    expect(plan({}, { Demo: 1 }, "auto")[0]).toMatchObject({ kind: "skip", reason: "deleted" });
    expect(plan({}, { Demo: 1 }, "manual")[0]?.kind).toBe("create");
  });

  it("an unmodified older version is updated; the current version is left alone", () => {
    expect(plan({ "Print Presets/Demo.md": v1 }, { Demo: 1 }, "auto")[0]?.kind).toBe("update");
    expect(
      plan({ "Print Presets/Demo.md": v1.replace(/\n/g, "\r\n") }, { Demo: 1 }, "auto")[0]?.kind,
    ).toBe("update");
    expect(plan({ "Print Presets/Demo.md": v2 }, { Demo: 2 }, "auto")[0]).toMatchObject({
      kind: "skip",
      reason: "up-to-date",
    });
  });

  it("a modified file is never overwritten; manual refresh writes a renamed copy once", () => {
    const edited = v1 + "my change\n";
    const auto = plan({ "Print Presets/Demo.md": edited }, { Demo: 1 }, "auto");
    expect(auto[0]).toMatchObject({ kind: "skip", reason: "modified" });
    const manual = plan({ "Print Presets/Demo.md": edited }, { Demo: 1 }, "manual");
    expect(manual[0]).toMatchObject({
      kind: "compare",
      path: "Print Presets/Demo (new starter).md",
    });
    expect(manual[0]?.kind === "compare" && manual[0].content).toContain(
      "name: Demo (new starter)",
    );
    const again = plan(
      { "Print Presets/Demo.md": edited, "Print Presets/Demo (new starter).md": "x" },
      { Demo: 1 },
      "manual",
    );
    expect(again[0]).toMatchObject({ kind: "skip", reason: "modified" });
    expect(installedAfter({}, auto)).toEqual({ Demo: 0 });
  });

  it("helpers", () => {
    expect(joinPath("", "a.md")).toBe("a.md");
    expect(compareCopy(demo).file).toBe("Demo (new starter).md");
    expect(starterHash("a\r\nb")).toBe(starterHash("a\nb"));
    expect(starterHash("a")).not.toBe(starterHash("b"));
  });
});
