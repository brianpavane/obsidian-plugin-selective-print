import { buildJob, type PrintJob } from "./job";
import { readNoteOverrides } from "./note-keys";
import { defaultPreset, matchPresets, type NoteFacts, type Preset } from "./presets";
import { finalSelection, resolveDefaults } from "./selection";
import type { SectionTree } from "./types";

/**
 * The job a note gets with no dialog: its matching preset (or `presetOverride`), its own
 * `print-exclude`, and the global list. Shared by Quick print and multi-note packs so they
 * always agree with the dialog's defaults.
 */
export interface NoteJobInput {
  tree: SectionTree;
  note: NoteFacts & { title: string };
  presets: readonly Preset[];
  globalExclude: readonly string[];
  settingsSkipEmpty: boolean;
  /** Use this preset for the note instead of the matched one (packs: "same preset for all"). */
  presetOverride?: Preset | null;
  includeTitle?: boolean;
}

export interface NoteJob {
  job: PrintJob;
  preset: Preset;
  /** Messages for the user (missing print-preset, invalid note keys, rule and marker warnings). */
  warnings: string[];
}

export function defaultJobForNote(input: NoteJobInput): NoteJob {
  const warnings: string[] = [];
  const overrides = readNoteOverrides(input.note.properties);
  warnings.push(...overrides.warnings.map((w) => w.message));
  let preset = input.presetOverride ?? null;
  if (!preset) {
    const match = matchPresets(input.presets, input.note);
    if (match.warning) warnings.push(match.warning);
    preset = defaultPreset(match);
  }
  const r = resolveDefaults({
    tree: input.tree,
    globalExclude: input.globalExclude,
    preset: preset.sections,
    noteExclude: overrides.noteExclude,
  });
  const omit = new Set(preset.properties.list.map((k) => k.toLowerCase()));
  const job = buildJob({
    tree: input.tree,
    included: finalSelection(r.defaults),
    title: input.note.title,
    includeTitle: input.includeTitle ?? preset.includeTitle,
    skipEmpty: preset.sections.skipEmpty ?? input.settingsSkipEmpty,
    inlineMarkers: preset.inlineMarkers,
    excludeCalloutTypes: preset.callouts.excludeTypes,
    properties: {
      values: input.note.properties,
      mode: preset.properties.mode === "except" ? "choose" : preset.properties.mode,
      chosen: Object.keys(input.note.properties).filter((k) => !omit.has(k.toLowerCase())),
    },
  });
  warnings.push(...[...r.warnings, ...job.warnings].map((w) => w.message));
  return { job, preset, warnings };
}
