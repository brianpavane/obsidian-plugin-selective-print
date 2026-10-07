import { describe, expect, it } from "vitest";
import {
  checkState,
  depths,
  invertSelection,
  selectAll,
  selectNone,
  sizeHint,
  toggleSection,
  visibleSections,
} from "../src/core/dialog-state";
import { parseSections } from "../src/core/sections";
import { finalSelection, resolveDefaults } from "../src/core/selection";
import { loadFixture } from "./helpers";

const tree = parseSections(loadFixture("transcript-nested.md"));
const sec = (title: string) => {
  const s = tree.all.find((x) => x.title === title);
  if (!s) throw new Error(title);
  return s;
};
const defaults = finalSelection(resolveDefaults({ tree, globalExclude: ["Transcript"] }).defaults);

describe("dialog state", () => {
  it("starts with Transcript and its children unchecked", () => {
    expect(checkState(sec("Transcript"), defaults)).toBe("unchecked");
    expect(checkState(sec("Summary"), defaults)).toBe("checked");
  });

  it("toggling a parent toggles its subtree", () => {
    const on = toggleSection(sec("Transcript"), defaults);
    expect(["Transcript", "Part 1", "Part 2"].every((t) => on.has(sec(t).id))).toBe(true);
    const off = toggleSection(sec("Transcript"), on);
    expect(["Transcript", "Part 1", "Part 2"].some((t) => off.has(sec(t).id))).toBe(false);
  });

  it("shows a mixed parent and checks the whole subtree on click", () => {
    const one = toggleSection(sec("Part 2"), defaults);
    expect(checkState(sec("Transcript"), one)).toBe("mixed");
    const all = toggleSection(sec("Transcript"), one);
    expect(checkState(sec("Transcript"), all)).toBe("checked");
  });

  it("quick actions", () => {
    expect(selectAll(tree).size).toBe(tree.all.length);
    expect(selectNone().size).toBe(0);
    const inv = invertSelection(tree, defaults);
    expect([...inv].sort()).toEqual(["2:Transcript#1", "3:Part 1#1", "3:Part 2#1"]);
  });

  it("depths and visible rows", () => {
    const d = depths(tree);
    expect(d.get(sec("Part 1").id)).toBe(1);
    expect(d.get(sec("Summary").id)).toBe(0);
    const withPreamble = parseSections("\n\n## A\nx\n");
    expect(visibleSections(withPreamble).map((s) => s.title)).toEqual(["A"]);
    const real = parseSections("intro\n## A\n");
    expect(visibleSections(real).map((s) => s.title)).toEqual(["Preamble", "A"]);
    expect(depths(real).get("0:Preamble#1")).toBe(0);
  });

  it("size hints", () => {
    expect(sizeHint(sec("Transcript"))).toBe("18 words");
    expect(sizeHint({ ...sec("Summary"), wordCount: 1 })).toBe("1 word");
    expect(sizeHint({ ...sec("Summary"), wordCount: 12345 })).toBe("12,345 words");
  });
});
