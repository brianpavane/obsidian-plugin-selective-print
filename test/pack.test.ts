import { describe, expect, it } from "vitest";
import { packLabels } from "../src/core/header-footer";
import { defaultJobForNote } from "../src/core/note-job";
import {
  filterPackByDate,
  linkpathOf,
  moveItem,
  noteDate,
  packAnchor,
  packDateRange,
  parsePackQuery,
  sortPackNotes,
  type PackNote,
} from "../src/core/pack";
import {
  conditionMatches,
  DEFAULT_PRESET,
  EVERYTHING_PRESET,
  type Preset,
} from "../src/core/presets";
import { parseSections } from "../src/core/sections";
import { loadFixture } from "./helpers";

function note(title: string, over: Partial<PackNote> = {}): PackNote {
  return { path: `Meetings/${title}.md`, title, properties: {}, tags: [], mtime: 0, ...over };
}

const a = note("2026-10-07 Sync", { mtime: 3 });
const b = note("Kickoff", { properties: { date: "2026-10-01" }, mtime: 1 });
const c = note("Retro", { properties: { Date: new Date("2026-10-09") }, mtime: 2 });
const d = note("Ideas", { mtime: 4 });
const e = note("Note 10", { mtime: 5 });
const f = note("Note 9", { mtime: 6 });

describe("note dates", () => {
  it("date property (text or Date), else a date in the title; invalid dates ignored", () => {
    expect(noteDate(a)).toBe("2026-10-07");
    expect(noteDate(b)).toBe("2026-10-01");
    expect(noteDate(c)).toBe("2026-10-09");
    expect(noteDate(d)).toBeNull();
    expect(noteDate(note("2026-02-30 Bad"))).toBeNull();
    expect(noteDate(note("X", { properties: { date: "soon" } }))).toBeNull();
    expect(noteDate(note("X", { properties: { date: new Date("x") } }))).toBeNull();
  });
});

describe("sorting", () => {
  it("by date: dated oldest first, undated last by name", () => {
    expect(sortPackNotes([d, c, a, b], "date").map((n) => n.title)).toEqual([
      "Kickoff",
      "2026-10-07 Sync",
      "Retro",
      "Ideas",
    ]);
  });
  it("by name, with natural numbers", () => {
    expect(sortPackNotes([e, f, d], "name").map((n) => n.title)).toEqual([
      "Ideas",
      "Note 9",
      "Note 10",
    ]);
  });
  it("by last modified", () => {
    expect(sortPackNotes([d, a, c, b], "modified").map((n) => n.title)).toEqual([
      "Kickoff",
      "Retro",
      "2026-10-07 Sync",
      "Ideas",
    ]);
  });
  it("same date ties sort by name", () => {
    const x = note("B 2026-10-07");
    const y = note("A 2026-10-07");
    expect(sortPackNotes([x, y], "date").map((n) => n.title)).toEqual([
      "A 2026-10-07",
      "B 2026-10-07",
    ]);
  });
});

describe("date filter and range", () => {
  it("keeps notes in range (inclusive) and reports undated ones", () => {
    const r = filterPackByDate([a, b, c, d], "2026-10-02", "2026-10-09");
    expect(r.kept.map((n) => n.title)).toEqual(["2026-10-07 Sync", "Retro"]);
    expect(r.undated.map((n) => n.title)).toEqual(["Ideas"]);
    expect(filterPackByDate([a, b], "2026-10-05", null).kept).toEqual([a]);
    expect(filterPackByDate([a, b], null, "2026-10-05").kept).toEqual([b]);
    expect(filterPackByDate([a, d], null, null)).toEqual({ kept: [a, d], undated: [] });
  });
  it("cover date range", () => {
    expect(packDateRange([d, c, b])).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(packDateRange([d])).toBeNull();
  });
});

describe("tag and property queries", () => {
  it("parses #tag, tag:, and property: value", () => {
    expect(parsePackQuery("#customer/contoso")).toEqual({
      ok: true,
      condition: { kind: "tag", tag: "customer/contoso" },
    });
    expect(parsePackQuery("tag: #weekly")).toEqual({
      ok: true,
      condition: { kind: "tag", tag: "weekly" },
    });
    expect(parsePackQuery(" type : meeting ")).toEqual({
      ok: true,
      condition: { kind: "property", property: "type", equals: "meeting" },
    });
    expect(parsePackQuery("").ok).toBe(false);
    expect(parsePackQuery("just words").ok).toBe(false);
  });
  it("queries match notes through the preset matcher", () => {
    const q = parsePackQuery("type: meeting");
    if (!q.ok) throw new Error("parse");
    expect(
      conditionMatches(q.condition, { path: "x.md", properties: { type: "Meeting" }, tags: [] }),
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("moveItem clamps and returns a new list", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 9, -1)).toEqual([1, 2, 3]);
  });
  it("link paths and anchors", () => {
    expect(linkpathOf("Kickoff#Decisions")).toBe("Kickoff");
    expect(linkpathOf("Folder/Kickoff|the kickoff")).toBe("Folder/Kickoff");
    expect(packAnchor(3)).toBe("selective-print-note-3");
  });
  it("pack header and footer labels", () => {
    expect(
      packLabels({ title: "Meetings", count: 1, printedAt: new Date(2026, 9, 7, 9, 0) }),
    ).toEqual({
      headerLeft: "Meetings",
      headerRight: "1 note",
      footerLeft: "Printed 2026-10-07 09:00",
    });
    expect(packLabels({ title: "M", count: 3, printedAt: new Date() }).headerRight).toBe("3 notes");
  });
});

describe("defaultJobForNote (shared by Quick print and packs)", () => {
  const tree = parseSections(loadFixture("meeting-generated.md"));
  const meetingPreset: Preset = {
    ...DEFAULT_PRESET,
    name: "Meeting recap",
    builtin: false,
    appliesTo: [[{ kind: "property", property: "type", equals: "meeting" }]],
    sections: { inheritGlobal: true, exclude: ["Agenda"], skipEmpty: true },
    properties: { mode: "except", list: ["attendees"] },
  };
  const facts = {
    path: "M.md",
    title: "M",
    properties: { type: "meeting", attendees: ["A"] },
    tags: [],
  };

  it("uses the matching preset with the global list: Transcript and Agenda out", () => {
    const r = defaultJobForNote({
      tree,
      note: facts,
      presets: [meetingPreset],
      globalExclude: ["Transcript"],
      settingsSkipEmpty: true,
    });
    expect(r.preset.name).toBe("Meeting recap");
    expect(r.job.markdown).not.toContain("## Transcript");
    expect(r.job.markdown).not.toContain("## Agenda");
    expect(r.job.properties).toEqual([["type", "meeting"]]);
    expect(r.warnings).toEqual([]);
  });

  it("a preset override applies to every note; the note's print-exclude still wins", () => {
    const everything = defaultJobForNote({
      tree,
      note: facts,
      presets: [meetingPreset],
      globalExclude: ["Transcript"],
      settingsSkipEmpty: false,
      presetOverride: EVERYTHING_PRESET,
    });
    expect(everything.job.markdown).toContain("## Transcript");
    const remembered = defaultJobForNote({
      tree,
      note: { ...facts, properties: { ...facts.properties, "print-exclude": ["Notes"] } },
      presets: [],
      globalExclude: ["Transcript"],
      settingsSkipEmpty: false,
      presetOverride: EVERYTHING_PRESET,
      includeTitle: false,
    });
    expect(remembered.job.markdown).toContain("## Transcript");
    expect(remembered.job.markdown).not.toContain("## Notes");
    expect(remembered.job.title).toBeNull();
  });

  it("collects warnings for a missing print-preset and bad note keys", () => {
    const r = defaultJobForNote({
      tree,
      note: { ...facts, properties: { "print-preset": "Ghost", "print-exclude": [1] } },
      presets: [],
      globalExclude: [],
      settingsSkipEmpty: true,
    });
    expect(r.warnings).toEqual([
      "print-exclude should be a list of heading names; it is ignored",
      'print-preset: no preset named "Ghost"',
    ]);
  });
});
