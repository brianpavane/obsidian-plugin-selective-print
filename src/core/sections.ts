import type { Section, SectionTree } from "./types";

/**
 * Section parser. Pure: string in, plain objects out.
 *
 * Parses the note *source*, not rendered HTML. Recognizes YAML frontmatter, ATX headings
 * (with closing `#` sequences), setext headings, and skips anything that looks like a
 * heading inside fenced code, HTML comments or Obsidian `%%` comments.
 *
 * Invariant (tested): concatenating every section's own slice
 * `lines[startLine, ownEndLine)` in `all` order, after the frontmatter, reproduces the source.
 */

/** Split into lines, each keeping its terminator, so `splitLines(s).join("") === s`. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split(/(?<=\n)/);
}

const FRONTMATTER_OPEN = /^---[ \t]*\r?\n$/;
const FRONTMATTER_CLOSE = /^(---|\.\.\.)[ \t]*(\r?\n)?$/;

/** Number of lines occupied by a frontmatter block at the top of `lines`, or 0. */
export function frontmatterLineCount(lines: readonly string[]): number {
  if (lines.length < 2 || !FRONTMATTER_OPEN.test(lines[0] ?? "")) return 0;
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_CLOSE.test(lines[i] ?? "")) return i + 1;
  }
  return 0; // unclosed: Obsidian does not treat it as frontmatter either
}

export interface SplitNote {
  frontmatter: string | null;
  body: string;
}

export function splitFrontmatter(source: string): SplitNote {
  const lines = splitLines(source);
  const n = frontmatterLineCount(lines);
  if (n === 0) return { frontmatter: null, body: source };
  return { frontmatter: lines.slice(0, n).join(""), body: lines.slice(n).join("") };
}

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/;
const SETEXT_H2 = /^ {0,3}-+[ \t]*$/;
const BLANK = /^\s*$/;
/** Lines that start a non-paragraph block: lists, quotes, tables, HTML, indented code. */
const NON_PARAGRAPH = /^(\s*([-*+]|\d+[.)])(\s|$)|\s*>|\s*\||\s*<| {4,}|\t)/;

function stripEol(line: string): string {
  return line.replace(/\r?\n$/, "");
}

/** Heading text as written: trimmed, with an ATX closing sequence (` ##`) removed. */
function atxTitle(content: string | undefined): string {
  if (!content) return "";
  const closed = content.replace(/(^|[ \t])#+[ \t]*$/, "");
  return closed.trim();
}

/** Remove Markdown syntax from heading text: wikilinks, links, emphasis, code. */
export function plainHeadingText(title: string): string {
  return title
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|~~|==)(.+?)\1/g, "$2")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawHeading {
  level: number;
  title: string;
  startLine: number;
  headingEndLine: number;
}

/**
 * Tracks block-level state that hides headings: fenced code, multi-line HTML comments and
 * Obsidian `%%` comments. Shared by the parser and the filters so they agree on structure.
 */
export class BlockScanner {
  private fence: { char: string; len: number } | null = null;
  private htmlComment = false;
  private percentComment = false;

  /** True when the line is inside (or opens/closes) a region where headings are ignored. */
  hidden(line: string): boolean {
    const text = stripEol(line);
    if (this.fence) {
      const m = FENCE.exec(text);
      if (m?.[1] && m[1][0] === this.fence.char && m[1].length >= this.fence.len && !m[2]?.trim()) {
        this.fence = null;
      }
      return true;
    }
    if (this.htmlComment) {
      if (text.includes("-->")) this.htmlComment = false;
      return true;
    }
    if (this.percentComment) {
      if (countPercent(text) % 2 === 1) this.percentComment = false;
      return true;
    }
    const fence = FENCE.exec(text);
    if (fence?.[1] && !(fence[1][0] === "`" && fence[2]?.includes("`"))) {
      this.fence = { char: fence[1][0] ?? "`", len: fence[1].length };
      return true;
    }
    if (/^ {0,3}<!--/.test(text) && !text.includes("-->", text.indexOf("<!--") + 4)) {
      this.htmlComment = true;
      return true;
    }
    if (countPercent(text) % 2 === 1) {
      this.percentComment = true;
      return true;
    }
    return false;
  }

  /** True while inside a fenced code block (after `hidden` has consumed the opening line). */
  get inFence(): boolean {
    return this.fence !== null;
  }
}

function countPercent(text: string): number {
  return text.match(/%%/g)?.length ?? 0;
}

function findHeadings(lines: readonly string[], from: number): RawHeading[] {
  const headings: RawHeading[] = [];
  const scanner = new BlockScanner();
  /** First line of the current paragraph run, or -1. */
  let paraStart = -1;
  /** Previous line was part of a non-paragraph block (lazy continuation is not a paragraph). */
  let prevOther = false;

  for (let i = from; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (scanner.hidden(raw)) {
      paraStart = -1;
      prevOther = false;
      continue;
    }
    const text = stripEol(raw);

    if (BLANK.test(text)) {
      paraStart = -1;
      prevOther = false;
      continue;
    }

    const atx = ATX.exec(text);
    if (atx?.[1]) {
      headings.push({
        level: atx[1].length,
        title: atxTitle(atx[2]),
        startLine: i,
        headingEndLine: i + 1,
      });
      paraStart = -1;
      prevOther = false;
      continue;
    }

    if (paraStart !== -1 && (SETEXT_H1.test(text) || SETEXT_H2.test(text))) {
      const title = lines
        .slice(paraStart, i)
        .map((l) => stripEol(l).trim())
        .join(" ");
      headings.push({
        level: SETEXT_H1.test(text) ? 1 : 2,
        title: title.trim(),
        startLine: paraStart,
        headingEndLine: i + 1,
      });
      paraStart = -1;
      prevOther = false;
      continue;
    }

    if (paraStart !== -1) continue; // paragraph continuation
    if (SETEXT_H2.test(text)) {
      prevOther = false; // thematic break: a leaf block, the next line may start a paragraph
      continue;
    }
    if (NON_PARAGRAPH.test(text) || prevOther) {
      prevOther = true;
      continue;
    }
    paraStart = i;
  }
  return headings;
}

const LIST_MARKER_ONLY = /^\s*([-*+]|\d+[.)])(\s+\[.\])?\s*$/;

/**
 * True when the lines contain no real content: only whitespace, empty list markers, empty
 * task checkboxes, HTML comments or Obsidian `%%` comments (neither of which renders).
 */
export function isEmptyContent(lines: readonly string[]): boolean {
  const text = lines
    .join("")
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/%%[\s\S]*?(%%|$)/g, "");
  return text.split("\n").every((l) => BLANK.test(l) || LIST_MARKER_ONLY.test(l));
}

function countWords(lines: readonly string[]): number {
  let n = 0;
  for (const line of lines) n += line.match(/\S+/g)?.length ?? 0;
  return n;
}

export interface ParseOptions {
  /** Detect a frontmatter block at the top. Default true; pass false for an already-split body. */
  frontmatter?: boolean;
}

export function parseSections(markdown: string, options: ParseOptions = {}): SectionTree {
  const lines = splitLines(markdown);
  const fmLines = options.frontmatter === false ? 0 : frontmatterLineCount(lines);
  const headings = findHeadings(lines, fmLines);
  const occurrences = new Map<string, number>();

  const makeId = (level: number, plain: string): string => {
    const key = `${level}:${plain}`;
    const n = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, n);
    return `${key}#${n}`;
  };

  const all: Section[] = [];
  const firstHeadingLine = headings[0]?.startLine ?? lines.length;
  let preamble: Section | null = null;
  if (firstHeadingLine > fmLines) {
    const body = lines.slice(fmLines, firstHeadingLine);
    preamble = {
      id: makeId(0, "Preamble"),
      level: 0,
      title: "Preamble",
      plainTitle: "Preamble",
      startLine: fmLines,
      headingEndLine: fmLines,
      ownEndLine: firstHeadingLine,
      endLine: firstHeadingLine,
      children: [],
      isEmpty: isEmptyContent(body),
      wordCount: countWords(body),
      lineCount: body.length,
    };
    all.push(preamble);
  }

  const roots: Section[] = [];
  const stack: Section[] = [];
  headings.forEach((h, idx) => {
    const plain = plainHeadingText(h.title);
    const section: Section = {
      id: makeId(h.level, plain),
      level: h.level,
      title: h.title,
      plainTitle: plain,
      startLine: h.startLine,
      headingEndLine: h.headingEndLine,
      ownEndLine: headings[idx + 1]?.startLine ?? lines.length,
      endLine: lines.length,
      children: [],
      isEmpty: true,
      wordCount: 0,
      lineCount: 0,
    };
    while (stack.length && (stack[stack.length - 1]?.level ?? 0) >= h.level) {
      const closed = stack.pop();
      if (closed) closed.endLine = h.startLine;
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(section);
    else roots.push(section);
    stack.push(section);
    all.push(section);
  });

  for (const s of all) {
    if (s.level === 0) continue;
    const body = lines.slice(s.headingEndLine, s.endLine);
    // Subtree emptiness ignores child heading lines: a parent whose children are all empty is empty.
    const contentLines = collectContentLines(lines, s);
    s.isEmpty = isEmptyContent(contentLines);
    s.wordCount = countWords(body);
    s.lineCount = body.length;
  }

  return {
    frontmatter: fmLines ? lines.slice(0, fmLines).join("") : null,
    bodyStartLine: fmLines,
    lines,
    preamble,
    roots,
    all,
  };
}

/** Own content plus every descendant's own content, without any heading lines. */
function collectContentLines(lines: readonly string[], s: Section): string[] {
  const out = lines.slice(s.headingEndLine, s.ownEndLine);
  for (const c of s.children) out.push(...collectContentLines(lines, c));
  return out;
}

/** Flatten a subtree (the section itself first). */
export function descendantsAndSelf(s: Section): Section[] {
  const out: Section[] = [s];
  for (const c of s.children) out.push(...descendantsAndSelf(c));
  return out;
}
