import { describe, expect, it } from "vitest";
import {
  BUILTIN_PRESETS,
  DEFAULT_PRESET,
  EVERYTHING_PRESET,
  defaultPreset,
  globToRegExp,
  matchPresets,
  orderForDropdown,
  validatePreset,
  validatePresetSet,
  type NoteFacts,
  type Preset,
} from "../src/core/presets";
import { fixtureFrontmatter } from "./helpers";

function load(name: string) {
  return validatePreset(fixtureFrontmatter(`presets/${name}`), `Print Presets/${name}`);
}

function fields(issues: { field: string }[]): string[] {
  return issues.map((i) => i.field);
}

describe("validatePreset", () => {
  it("accepts a complete valid preset", () => {
    const v = load("valid.md");
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.preset).toMatchObject({
      name: "Meeting recap",
      sections: {
        inheritGlobal: true,
        exclude: ["Agenda", "Notes", "regex:^Appendix"],
        skipEmpty: true,
      },
      properties: { mode: "except", list: ["attendees"] },
      callouts: { excludeTypes: ["private"] },
      output: {
        format: "print",
        pdfFolder: "Exports",
        filename: "{date} - {title}",
        paper: "letter",
      },
      builtin: false,
      file: "Print Presets/valid.md",
    });
    expect(v.preset?.appliesTo).toEqual([
      [{ kind: "property", property: "type", equals: "meeting" }],
      [
        { kind: "tag", tag: "customer-call" },
        { kind: "folder", folder: "Projects/Active" },
      ],
      [{ kind: "filename", pattern: "* - weekly review" }],
    ]);
  });

  it("fills defaults for a minimal preset; settings-backed fields stay unset", () => {
    const v = load("minimal.md");
    expect(v.errors).toEqual([]);
    expect(v.preset).toMatchObject({
      name: "Minimal",
      description: "",
      appliesTo: [],
      sections: { inheritGlobal: true, exclude: [] },
      includeTitle: true,
      properties: { mode: "all", list: [] },
      inlineMarkers: true,
      output: {},
    });
    expect(v.preset?.sections.skipEmpty).toBeUndefined();
  });

  it("reports missing required keys", () => {
    const v = load("missing-keys.md");
    expect(v.preset).toBeUndefined();
    expect(fields(v.errors)).toEqual(["selective-print-preset", "preset-version", "name"]);
  });

  it("reports wrong types with the field and expected value", () => {
    const v = load("wrong-types.md");
    expect(v.preset).toBeUndefined();
    expect(fields(v.errors)).toEqual([
      "selective-print-preset",
      "applies-to",
      "sections.exclude",
      "sections.inherit-global",
      "include-title",
      "properties.mode",
      "output.paper",
    ]);
    expect(v.errors.find((e) => e.field === "output.paper")?.message).toBe(
      'expected one of letter, a4, got "tabloid"',
    );
    expect(v.errors.every((e) => e.file === "Print Presets/wrong-types.md")).toBe(true);
  });

  it("warns about unknown keys but keeps the preset", () => {
    const v = load("unknown-keys.md");
    expect(v.errors).toEqual([]);
    expect(fields(v.warnings)).toEqual(["colour", "sections.include", "output.dpi"]);
    expect(v.preset?.name).toBe("Unknown keys");
  });

  it("rejects an invalid regex", () => {
    const v = load("bad-regex.md");
    expect(v.preset).toBeUndefined();
    expect(fields(v.errors)).toEqual(["sections.exclude[0]"]);
  });

  it("rejects an unsupported preset-version", () => {
    const v = load("future-version.md");
    expect(v.errors[0]?.message).toMatch(/unsupported version 2/);
  });

  it("rejects non-objects and bad matcher entries", () => {
    expect(validatePreset(null, "x.md").errors[0]?.field).toBe("(frontmatter)");
    const base = { "selective-print-preset": true, "preset-version": 1, name: "M" };
    const v = validatePreset(
      {
        ...base,
        "applies-to": ["meeting", { equals: "x" }, { property: "type" }, { weird: 1 }, {}],
        "starter-version": 1.5,
        sections: "nope",
      },
      "m.md",
    );
    expect(fields(v.errors)).toEqual([
      "starter-version",
      "applies-to[0]",
      "applies-to[1].equals",
      "applies-to[2].equals",
      "applies-to[3].weird",
      "applies-to[4]",
      "sections",
    ]);
  });

  it("accepts number and boolean equals values and keeps starter-version", () => {
    const v = validatePreset(
      {
        "selective-print-preset": true,
        "preset-version": 1,
        name: "N",
        "starter-version": 2,
        "applies-to": [
          { property: "priority", equals: 1 },
          { property: "draft", equals: false },
        ],
        output: { format: "pdf", orientation: "landscape", footer: "Confidential", paper: "a4" },
      },
      "n.md",
    );
    expect(v.errors).toEqual([]);
    expect(v.preset?.starterVersion).toBe(2);
    expect(v.preset?.output).toEqual({
      format: "pdf",
      orientation: "landscape",
      footer: "Confidential",
      paper: "a4",
    });
  });

  it("rejects list items and equals of the wrong type", () => {
    const v = validatePreset(
      {
        "selective-print-preset": true,
        "preset-version": 1,
        name: "L",
        "applies-to": [{ property: "a", equals: ["x"] }],
        callouts: { "exclude-types": ["private", 3] },
        description: 5,
      },
      "l.md",
    );
    expect(fields(v.errors)).toEqual([
      "applies-to[0].equals",
      "description",
      "callouts.exclude-types[1]",
    ]);
  });
});

describe("validatePresetSet", () => {
  it("skips invalid files and duplicate names (case-insensitive), keeping the first by path", () => {
    const names = ["duplicate-b.md", "duplicate-a.md", "valid.md", "bad-regex.md", "minimal.md"];
    const r = validatePresetSet(
      names.map((n) => ({
        file: `Print Presets/${n}`,
        frontmatter: fixtureFrontmatter(`presets/${n}`),
      })),
    );
    expect(r.presets.map((p) => p.name)).toEqual(["Shared Name", "Minimal", "Meeting recap"]);
    expect(r.errors.map((e) => `${e.file}:${e.field}`)).toEqual([
      "Print Presets/bad-regex.md:sections.exclude[0]",
      "Print Presets/duplicate-b.md:name",
    ]);
  });

  it("does not allow a file to take a built-in name", () => {
    const r = validatePresetSet([
      {
        file: "d.md",
        frontmatter: { "selective-print-preset": true, "preset-version": 1, name: "default" },
      },
    ]);
    expect(r.presets).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/already used by built-in/);
  });
});

function preset(name: string, appliesTo: Preset["appliesTo"]): Preset {
  return { ...DEFAULT_PRESET, name, appliesTo, builtin: false };
}

const note: NoteFacts = {
  path: "Projects/Active/Contoso/2026-10-07 - weekly review.md",
  properties: { Type: "Meeting", tags: ["customer-call"] },
  tags: ["#customer-call/contoso", "planning"],
};

describe("matching and specificity", () => {
  const byProperty = preset("By property", [
    [{ kind: "property", property: "type", equals: "meeting" }],
  ]);
  const byTag = preset("By tag", [[{ kind: "tag", tag: "customer-call" }]]);
  const byFolder = preset("By folder", [[{ kind: "folder", folder: "Projects/Active/" }]]);
  const byFilename = preset("By filename", [[{ kind: "filename", pattern: "* - Weekly Review" }]]);
  const byTagAndFolder = preset("By tag and folder", [
    [
      { kind: "tag", tag: "customer-call" },
      { kind: "folder", folder: "Projects/Active" },
    ],
  ]);
  const noMatch = preset("No match", [[{ kind: "folder", folder: "Elsewhere" }]]);
  const all = [byFilename, noMatch, byFolder, byTag, byProperty, byTagAndFolder];

  it("orders property > tag > folder > filename; more conditions break ties", () => {
    const r = matchPresets(all, note);
    expect(r.matches.map((m) => m.preset.name)).toEqual([
      "By property",
      "By tag and folder",
      "By tag",
      "By folder",
      "By filename",
    ]);
    expect(defaultPreset(r).name).toBe("By property");
  });

  it("requires all conditions within an entry", () => {
    const strict = preset("Strict", [
      [
        { kind: "tag", tag: "customer-call" },
        { kind: "folder", folder: "Elsewhere" },
      ],
    ]);
    expect(matchPresets([strict], note).matches).toEqual([]);
  });

  it("falls back to the built-in Default when nothing matches", () => {
    const r = matchPresets([noMatch], note);
    expect(r.matches).toEqual([]);
    expect(defaultPreset(r)).toBe(DEFAULT_PRESET);
  });

  it("print-preset forces a preset (including built-ins) and puts it first", () => {
    const forced = matchPresets(all, {
      ...note,
      properties: { ...note.properties, "print-preset": "by filename" },
    });
    expect(forced.matches[0]).toMatchObject({ preset: byFilename, forced: true });
    expect(forced.matches).toHaveLength(5);
    const everything = matchPresets(all, { ...note, properties: { "print-preset": "Everything" } });
    expect(defaultPreset(everything)).toBe(EVERYTHING_PRESET);
  });

  it("warns when print-preset names a missing preset", () => {
    const r = matchPresets(all, { ...note, properties: { "print-preset": "Ghost" } });
    expect(r.warning).toBe('print-preset: no preset named "Ghost"');
    // "Ghost" replaces the note's properties here, so the property preset no longer matches.
    expect(r.matches[0]?.preset).toBe(byTagAndFolder);
  });

  it("matches list-valued properties, numbers and booleans as text", () => {
    const p = preset("P", [[{ kind: "property", property: "status", equals: 1 }]]);
    expect(
      matchPresets([p], { ...note, properties: { status: ["draft", 1] } }).matches,
    ).toHaveLength(1);
    expect(
      matchPresets([p], { ...note, properties: { status: { nested: 1 } } }).matches,
    ).toHaveLength(0);
    const b = preset("B", [[{ kind: "property", property: "done", equals: true }]]);
    expect(matchPresets([b], { ...note, properties: { done: true } }).matches).toHaveLength(1);
  });

  it("folder matching covers subfolders and the vault root", () => {
    const root = preset("Root", [[{ kind: "folder", folder: "/" }]]);
    expect(matchPresets([root], { ...note, path: "Top.md" }).matches).toHaveLength(1);
    expect(matchPresets([root], note).matches).toHaveLength(0);
    const partial = preset("Partial", [[{ kind: "folder", folder: "Projects/Act" }]]);
    expect(matchPresets([partial], note).matches).toHaveLength(0);
  });

  it("globs are case-insensitive and escape regex characters", () => {
    expect(globToRegExp("Meeting Tracker*").test("meeting tracker 2026")).toBe(true);
    expect(globToRegExp("a.b?").test("a.bc")).toBe(true);
    expect(globToRegExp("a.b").test("axb")).toBe(false);
    expect(globToRegExp("(x)").test("(x)")).toBe(true);
  });

  it("dropdown order: matches, then others by name, then Default and Everything", () => {
    const r = matchPresets(all, note);
    expect(orderForDropdown(all, r).map((p) => p.name)).toEqual([
      "By property",
      "By tag and folder",
      "By tag",
      "By folder",
      "By filename",
      "No match",
      "Default",
      "Everything",
    ]);
    const forced = matchPresets(all, { ...note, properties: { "print-preset": "Everything" } });
    const order = orderForDropdown(all, forced).map((p) => p.name);
    expect(order[0]).toBe("Everything");
    expect(order.filter((n) => n === "Everything")).toHaveLength(1);
  });

  it("built-ins have the documented behavior", () => {
    expect(BUILTIN_PRESETS.map((p) => [p.name, p.sections.inheritGlobal])).toEqual([
      ["Default", true],
      ["Everything", false],
    ]);
  });
});

describe("presetFrontmatter (Save as new preset)", () => {
  it("produces frontmatter that validates back to the same choices", async () => {
    const { presetFrontmatter, presetNameProblem } = await import("../src/core/presets");
    const fm = presetFrontmatter({
      name: "  My recap ",
      description: "From the dialog",
      appliesTo: [
        [{ kind: "property", property: "type", equals: "meeting" }],
        [
          { kind: "tag", tag: "x" },
          { kind: "folder", folder: "F" },
        ],
        [{ kind: "filename", pattern: "A*" }],
      ],
      exclude: ["Agenda", "Transcript"],
      inheritGlobal: false,
      skipEmpty: true,
      includeTitle: false,
      properties: { mode: "except", list: ["attendees"] },
    });
    const v = validatePreset(fm, "Print Presets/My recap.md");
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.preset).toMatchObject({
      name: "My recap",
      description: "From the dialog",
      sections: { inheritGlobal: false, exclude: ["Agenda", "Transcript"], skipEmpty: true },
      includeTitle: false,
      properties: { mode: "except", list: ["attendees"] },
      inlineMarkers: true,
    });
    expect(v.preset?.appliesTo).toHaveLength(3);
    expect(presetNameProblem(" ", [])).toBe("Enter a name.");
    expect(presetNameProblem("everything", [])).toMatch(/already exists/);
    expect(presetNameProblem("New", [])).toBeNull();
  });
});
