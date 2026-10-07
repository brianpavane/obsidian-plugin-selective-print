import { describe, expect, it } from "vitest";
import { defaultSettings, migrateSettings, SETTINGS_SCHEMA_VERSION } from "../src/settings";

describe("migrateSettings", () => {
  it("returns defaults for a first install (no data.json)", () => {
    expect(migrateSettings(null)).toEqual(defaultSettings());
    expect(migrateSettings(undefined)).toEqual(defaultSettings());
  });

  it("prepopulates the global exclude list with Transcript and review on", () => {
    const s = migrateSettings(null);
    expect(s.globalExclude).toEqual(["Transcript"]);
    expect(s.alwaysReview).toBe(true);
    expect(s.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("keeps valid stored values", () => {
    const s = migrateSettings({ schemaVersion: 1, globalExclude: [], paper: "a4", marginsIn: 1 });
    expect(s.globalExclude).toEqual([]);
    expect(s.paper).toBe("a4");
    expect(s.marginsIn).toBe(1);
  });

  it("falls back to defaults for wrong types, bad enums and unknown keys", () => {
    const s = migrateSettings({
      globalExclude: ["ok", 3],
      paper: "tabloid",
      alwaysReview: "yes",
      marginsIn: Number.NaN,
      surprise: true,
    });
    expect(s).toEqual(defaultSettings());
  });

  it("keeps numeric installed-starter versions and drops the rest", () => {
    const s = migrateSettings({ installedStarters: { "Meeting notes": 1, Bad: "x", Gone: 0 } });
    expect(s.installedStarters).toEqual({ "Meeting notes": 1, Gone: 0 });
    expect(migrateSettings({ installedStarters: [1] }).installedStarters).toEqual({});
  });

  it("does not share the default array between calls", () => {
    const a = defaultSettings();
    a.globalExclude.push("Notes");
    expect(defaultSettings().globalExclude).toEqual(["Transcript"]);
  });
});
