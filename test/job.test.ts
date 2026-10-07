import { describe, expect, it } from "vitest";
import { selectAll, toggleSection } from "../src/core/dialog-state";
import { buildJob, isControlProperty, propertyDisplay, type JobInput } from "../src/core/job";
import { parseSections } from "../src/core/sections";
import { finalSelection, resolveDefaults } from "../src/core/selection";
import { loadFixture } from "./helpers";

const tree = parseSections(loadFixture("meeting-generated.md"));
const props = {
  type: "meeting",
  date: "2026-10-07",
  attendees: ["Alex Example", "Sam Sample"],
  "print-exclude": ["Agenda"],
};
const defaults = finalSelection(resolveDefaults({ tree, globalExclude: ["Transcript"] }).defaults);

function input(over: Partial<JobInput> = {}): JobInput {
  return {
    tree,
    included: defaults,
    title: "2026-10-07 Contoso pilot sync",
    includeTitle: true,
    skipEmpty: true,
    inlineMarkers: true,
    excludeCalloutTypes: [],
    properties: { values: props, mode: "all", chosen: [] },
    ...over,
  };
}

describe("buildJob: the Markdown passed to the renderer (M2 acceptance)", () => {
  it("default selection on the meeting note (comment-only preamble is skipped as empty)", () => {
    const job = buildJob(input());
    expect(job.markdown).toMatchInlineSnapshot(`
      "## Meeting Summary
      Fictional summary of the Contoso pilot sync.

      ## Agenda
      - Pilot timeline
      - Budget

      ## Action items
      - [ ] Alex Example: send the recap

      "
    `);
    expect(job.title).toBe("2026-10-07 Contoso pilot sync");
    expect(job.stats).toEqual({ included: 3, excluded: 1, emptySkipped: 2 });
  });

  it("checking Transcript includes it; nothing else changes", () => {
    const transcript = tree.all.find((s) => s.title === "Transcript");
    if (!transcript) throw new Error("fixture");
    const job = buildJob(input({ included: toggleSection(transcript, defaults) }));
    expect(job.markdown).toContain(
      "## Transcript\nSpeaker 1: Welcome, everyone.\nSpeaker 2: Thanks for having us.\n",
    );
    expect(job.markdown.indexOf("## Action items")).toBeLessThan(
      job.markdown.indexOf("## Transcript"),
    );
  });

  it("select all without skip-empty reproduces the whole body", () => {
    const job = buildJob(input({ included: selectAll(tree), skipEmpty: false }));
    expect(job.markdown).toBe(
      loadFixture("meeting-generated.md").split("---\n").slice(2).join("---\n"),
    );
  });

  it("title off, properties none / all / choose; control keys never printed", () => {
    expect(buildJob(input({ includeTitle: false })).title).toBeNull();
    expect(
      buildJob(input({ properties: { values: props, mode: "none", chosen: [] } })).properties,
    ).toEqual([]);
    expect(buildJob(input()).properties.map(([k]) => k)).toEqual(["type", "date", "attendees"]);
    const chosen = buildJob(
      input({ properties: { values: props, mode: "choose", chosen: ["DATE", "print-exclude"] } }),
    );
    expect(chosen.properties).toEqual([["date", "2026-10-07"]]);
  });

  it("control property detection and value display", () => {
    expect(isControlProperty("Print-Preset")).toBe(true);
    expect(isControlProperty("printer")).toBe(false);
    expect(propertyDisplay(["a", 1, true, null])).toBe("a, 1, true");
    expect(propertyDisplay(new Date("2026-10-07T00:00:00Z"))).toBe("2026-10-07");
    expect(propertyDisplay(new Date("x"))).toBe("");
    expect(propertyDisplay({ a: 1 })).toBe('{"a":1}');
    expect(propertyDisplay(undefined)).toBe("");
  });
});
