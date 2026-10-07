import { App, getAllTags, MarkdownView, TFile } from "obsidian";

/** Everything the pipeline needs from one note, read once per invocation. */
export interface NoteSnapshot {
  file: TFile;
  /** Full source, frontmatter included. Taken from an open editor when there is one. */
  source: string;
  /** Basename without extension. */
  title: string;
  properties: Record<string, unknown>;
  tags: string[];
}

export async function readNote(app: App, file: TFile): Promise<NoteSnapshot> {
  let source: string | null = null;
  // An open editor may hold changes not yet saved to disk; print what the user sees.
  app.workspace.iterateAllLeaves((leaf) => {
    if (
      source === null &&
      leaf.view instanceof MarkdownView &&
      leaf.view.file?.path === file.path
    ) {
      source = leaf.view.getViewData();
    }
  });
  const text = source ?? (await app.vault.cachedRead(file));
  const cache = app.metadataCache.getFileCache(file);
  return {
    file,
    source: text,
    title: file.basename,
    properties: { ...(cache?.frontmatter ?? {}) },
    tags: cache ? (getAllTags(cache) ?? []) : [],
  };
}
