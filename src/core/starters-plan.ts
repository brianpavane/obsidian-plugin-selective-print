/**
 * Starter preset installation and upgrades (SPEC 4). Pure: decides what to write; the
 * Obsidian layer performs the writes.
 *
 * Rules:
 * - First run, or a new starter in a plugin upgrade: create the file.
 * - Existing file identical to a previously shipped version (unmodified): update it.
 * - Existing file the user modified: never touch it. A manual refresh writes the new version
 *   next to it as "<file> (new starter).md", with " (new starter)" added to its name.
 * - A starter the user deleted is not re-created automatically; a manual refresh re-creates it.
 */

export interface StarterDef {
  /** Preset name in the file's frontmatter. */
  name: string;
  /** File name inside the presets folder, e.g. "Meeting notes.md". */
  file: string;
  version: number;
  content: string;
  /** Hashes (starterHash) of every version ever shipped, including the current one. */
  shippedHashes: readonly string[];
}

export type StarterAction =
  | { kind: "create"; starter: StarterDef; path: string; content: string }
  | { kind: "update"; starter: StarterDef; path: string; content: string }
  | { kind: "compare"; starter: StarterDef; path: string; content: string }
  | {
      kind: "skip";
      starter: StarterDef;
      path: string;
      reason: "up-to-date" | "modified" | "deleted";
    };

export interface PlanInput {
  starters: readonly StarterDef[];
  /** Normalized vault folder ("" for the vault root). */
  folder: string;
  /** Current content of a vault file, or null when it does not exist. */
  read: (path: string) => string | null;
  /** Starter name -> version last installed (from settings). */
  installed: Readonly<Record<string, number>>;
  mode: "auto" | "manual";
}

/** FNV-1a 32-bit over the content with normalized line endings. Not for security. */
export function starterHash(content: string): string {
  const text = content.replace(/\r\n/g, "\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function joinPath(folder: string, file: string): string {
  return folder ? `${folder}/${file}` : file;
}

/** The side-by-side copy offered when a starter was modified: renamed so names stay unique. */
export function compareCopy(starter: StarterDef): { file: string; content: string } {
  const file = starter.file.replace(/\.md$/i, "") + " (new starter).md";
  const content = starter.content.replace(/^name:.*$/m, `name: ${starter.name} (new starter)`);
  return { file, content };
}

export function planStarterSync(input: PlanInput): StarterAction[] {
  const actions: StarterAction[] = [];
  for (const starter of input.starters) {
    const path = joinPath(input.folder, starter.file);
    const current = input.read(path);
    if (current === null) {
      if (input.mode === "manual" || !(starter.name in input.installed)) {
        actions.push({ kind: "create", starter, path, content: starter.content });
      } else {
        actions.push({ kind: "skip", starter, path, reason: "deleted" });
      }
      continue;
    }
    const hash = starterHash(current);
    if (hash === starterHash(starter.content)) {
      actions.push({ kind: "skip", starter, path, reason: "up-to-date" });
    } else if (starter.shippedHashes.includes(hash)) {
      actions.push({ kind: "update", starter, path, content: starter.content });
    } else {
      const copy = compareCopy(starter);
      const copyPath = joinPath(input.folder, copy.file);
      if (input.mode === "manual" && input.read(copyPath) === null) {
        actions.push({ kind: "compare", starter, path: copyPath, content: copy.content });
      } else {
        actions.push({ kind: "skip", starter, path, reason: "modified" });
      }
    }
  }
  return actions;
}

/** Installed-version record after applying `actions`. */
export function installedAfter(
  installed: Readonly<Record<string, number>>,
  actions: readonly StarterAction[],
): Record<string, number> {
  const next: Record<string, number> = { ...installed };
  for (const a of actions) {
    if (
      a.kind === "create" ||
      a.kind === "update" ||
      (a.kind === "skip" && a.reason === "up-to-date")
    ) {
      next[a.starter.name] = a.starter.version;
    } else if (!(a.starter.name in next)) {
      next[a.starter.name] = 0; // seen, but this version was not installed (modified copy)
    }
  }
  return next;
}
