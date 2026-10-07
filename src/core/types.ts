/**
 * Plain data types shared by the pure core. No Obsidian or DOM imports anywhere in src/core.
 * Line numbers are 0-based indices into the full note source (frontmatter included);
 * ranges are half-open: [start, end).
 */

export interface Section {
  /** Stable id: `<level>:<plain title>#<occurrence>`, e.g. `2:Decisions#1`. Preamble is `0:Preamble#1`. */
  id: string;
  /** Heading level 1-6; 0 for the Preamble pseudo-section. */
  level: number;
  /** Heading text as written, trimmed, closing `#` sequence removed. */
  title: string;
  /** Heading text with Markdown syntax removed (links, emphasis, code). Used for matching and ids. */
  plainTitle: string;
  /** First line of the heading (for setext headings, the first text line). */
  startLine: number;
  /** First line after the heading itself. */
  headingEndLine: number;
  /** End of this section's own content: the next heading of any level. */
  ownEndLine: number;
  /** End of the whole subtree: the next heading of the same or a higher level. */
  endLine: number;
  children: Section[];
  /** True when the whole subtree has no real content (see isEmptyContent). */
  isEmpty: boolean;
  /** Words in the subtree, excluding this section's own heading. */
  wordCount: number;
  /** Lines in the subtree, excluding this section's own heading. */
  lineCount: number;
}

export interface SectionTree {
  /** The frontmatter block including its `---` delimiters, or null. */
  frontmatter: string | null;
  /** First body line (0 when there is no frontmatter). */
  bodyStartLine: number;
  /** Source split into lines; each keeps its line terminator, so `lines.join("")` is the source. */
  lines: string[];
  /** Content before the first heading, or null when there is none. */
  preamble: Section | null;
  /** Top-level sections (children nest below). */
  roots: Section[];
  /** Every section including the preamble, in document order. */
  all: Section[];
}

export type ExclusionSource = "global" | "preset" | "note";

export interface SectionDefault {
  id: string;
  excluded: boolean;
  /** Which rule set excluded it; null when included. */
  source: ExclusionSource | null;
  /** True when excluded only because an ancestor was excluded. */
  viaAncestor: boolean;
}

export interface CoreWarning {
  code:
    | "not-found"
    | "invalid-rule"
    | "unmatched-marker-start"
    | "unmatched-marker-end"
    | "filename-variable"
    | "note-key"
    | "remember-lossy";
  message: string;
  line?: number;
}
