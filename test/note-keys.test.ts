import { describe, expect, it } from "vitest";
import { toggleSection } from "../src/core/dialog-state";
import { readNoteOverrides, rememberList } from "../src/core/note-keys";
import { parseSections } from "../src/core/sections";
import { finalSelection, resolveDefaults } from "../src/core/selection";
import { loadFixture } from "./helpers";

describe("readNoteOverrides", () => {
  it("absent keys", () => {
    expect(readNoteOverrides({ type: "meeting" })).toEqual({
      noteExclude: null,
      forcedPreset: null,
      warnings: [],
    });
  });

  it("print-exclude as list, single string, empty, null", () => {
    expect(readNoteOverrides({ "print-exclude": ["Agenda", " ", "Notes"] }).noteExclude).toEqual([
      "Agenda",
      "Notes",
    ]);
    expect(readNoteOverrides({ "print-exclude": "Agenda" }).noteExclude).toEqual(["Agenda"]);
    expect(readNoteOverrides({ "print-exclude": [] }).noteExclude).toEqual([]);
    expect(readNoteOverrides({ "print-exclude": null }).noteExclude).toEqual([]);
    expect(readNoteOverrides({ "Print-Exclude": "" }).noteExclude).toEqual([]);
  });

  it("invalid values are ignored with a warning", () => {
    const r = readNoteOverrides({ "print-exclude": [1, 2], "print-preset": 5 });
    expect(r.noteExclude).toBeNull();
    expect(r.forcedPreset).toBeNull();
    expect(r.warnings.map((w) => w.code)).toEqual(["note-key", "note-key"]);
  });

  it("print-preset", () => {
    expect(readNoteOverrides({ "print-preset": " Meeting recap " }).forcedPreset).toBe(
      "Meeting recap",
    );
    expect(readNoteOverrides({ "print-preset": null }).warnings).toEqual([]);
  });
});

describe("rememberList", () => {
  it("lists unchecked headings by name, once, in document order", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const included = finalSelection(
      resolveDefaults({ tree, globalExclude: ["Transcript", "Agenda"] }).defaults,
    );
    expect(rememberList(tree, included)).toEqual({ list: ["Agenda", "Transcript"], warnings: [] });
  });

  it("round-trips: remembering, then resolving with print-exclude, gives the same selection", () => {
    const tree = parseSections(loadFixture("meeting-generated.md"));
    const included = finalSelection(
      resolveDefaults({ tree, globalExclude: ["Transcript", "Notes"] }).defaults,
    );
    const { list } = rememberList(tree, included);
    const again = finalSelection(
      resolveDefaults({ tree, globalExclude: [], noteExclude: list }).defaults,
    );
    expect([...again].sort()).toEqual([...included].sort());
  });

  it("reports selections that names cannot reproduce", () => {
    const nested = parseSections(loadFixture("transcript-nested.md"));
    const part2 = nested.all.find((s) => s.title === "Part 2");
    if (!part2) throw new Error("fixture");
    const defaults = finalSelection(
      resolveDefaults({ tree: nested, globalExclude: ["Transcript"] }).defaults,
    );
    const mixed = rememberList(nested, toggleSection(part2, defaults));
    expect(mixed.list).toEqual(["Transcript", "Part 1"]);
    expect(mixed.warnings.map((w) => w.message)).toEqual([
      'Parts of "Transcript" were included, but next time the whole section will be excluded.',
    ]);

    const dup = parseSections(loadFixture("duplicate-headings.md"));
    const firstNotes = dup.all.find((s) => s.id === "2:Notes#1");
    if (!firstNotes) throw new Error("fixture");
    const r = rememberList(dup, new Set(dup.all.filter((s) => s !== firstNotes).map((s) => s.id)));
    expect(r.list).toEqual(["Notes"]);
    expect(r.warnings).toHaveLength(2);

    const pre = parseSections("intro\n## A\n");
    expect(rememberList(pre, new Set(["2:A#1"])).warnings[0]?.message).toMatch(/preamble/);

    const blank = parseSections("##\n");
    expect(rememberList(blank, new Set()).warnings[0]?.message).toMatch(/without text/);
  });
});
