import { filterNote } from "./filter";
import type { CoreWarning, SectionTree } from "./types";

/**
 * Turn one invocation's choices into exactly what gets rendered. Pure; the Obsidian layer
 * renders `markdown` and lays out `title` and `properties` above it.
 */

export type PropertiesChoice = "none" | "all" | "choose";

export interface JobInput {
  tree: SectionTree;
  /** Included section ids (from the dialog or the defaults). */
  included: ReadonlySet<string>;
  /** Note title (basename). */
  title: string;
  includeTitle: boolean;
  skipEmpty: boolean;
  inlineMarkers: boolean;
  excludeCalloutTypes: readonly string[];
  properties: {
    values: Readonly<Record<string, unknown>>;
    mode: PropertiesChoice;
    /** Property names to show when mode is "choose". */
    chosen: readonly string[];
  };
}

export interface PrintJob {
  /** Title to print above the content, or null when switched off. */
  title: string | null;
  /** Filtered Markdown body (no frontmatter). This is what the renderer receives. */
  markdown: string;
  /** Properties to print, in note order, as [name, value]. */
  properties: [string, unknown][];
  warnings: CoreWarning[];
  stats: { included: number; excluded: number; emptySkipped: number };
}

/** Plugin control keys are never printed as properties. */
export function isControlProperty(name: string): boolean {
  return name.toLowerCase().startsWith("print-");
}

export function buildJob(input: JobInput): PrintJob {
  const values = Object.fromEntries(
    Object.entries(input.properties.values).filter(([k]) => !isControlProperty(k)),
  );
  const chosen = new Set(input.properties.chosen.map((k) => k.toLowerCase()));
  const result = filterNote(input.tree, {
    included: input.included,
    inlineMarkers: input.inlineMarkers,
    excludeCalloutTypes: input.excludeCalloutTypes,
    skipEmpty: input.skipEmpty,
    properties:
      input.properties.mode === "choose"
        ? {
            values,
            mode: "except",
            list: Object.keys(values).filter((k) => !chosen.has(k.toLowerCase())),
          }
        : { values, mode: input.properties.mode },
  });
  return {
    title: input.includeTitle ? input.title : null,
    markdown: result.body,
    properties: Object.entries(result.properties ?? {}),
    warnings: result.warnings,
    stats: result.stats,
  };
}

/** Display text for a property value: lists joined with ", ", dates as YYYY-MM-DD. */
export function propertyDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value))
    return value
      .map(propertyDisplay)
      .filter((v) => v !== "")
      .join(", ");
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
