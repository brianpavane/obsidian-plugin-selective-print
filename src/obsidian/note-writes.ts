import { App, TFile } from "obsidian";
import { NOTE_EXCLUDE_KEY } from "../core/note-keys";

/**
 * The only place that modifies notes. Called only when the user clicks "Remember for this
 * note" (CLAUDE.md section 3.8). Uses processFrontMatter, so the note body is never touched.
 */
export async function rememberExclusions(
  app: App,
  file: TFile,
  list: readonly string[],
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm[NOTE_EXCLUDE_KEY] = [...list];
  });
}
