/**
 * Page header and footer (0.5.0, approved by Brian 2026-10-07):
 *   header: note location (folder path and name)  |  "Last modified <date time>"
 *   footer: "Printed <date time>"                 |  "Page X of Y"
 * Pure: builds the labels, the CSS page-margin boxes used by the Print adapter, and the HTML
 * templates used by Electron's printToPDF. Every value is escaped for its context.
 */

export interface PageLabels {
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local time as "YYYY-MM-DD HH:mm". */
export function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Folder/Sub/Note name" for a vault path like "Folder/Sub/Note name.md". */
export function noteLocation(path: string): string {
  return path.replace(/\.md$/i, "");
}

export function pageLabels(input: {
  path: string;
  printedAt: Date;
  modifiedAt: Date | null;
}): PageLabels {
  const modified =
    input.modifiedAt && !Number.isNaN(input.modifiedAt.getTime())
      ? formatTimestamp(input.modifiedAt)
      : "unknown";
  return {
    headerLeft: noteLocation(input.path),
    headerRight: `Last modified ${modified}`,
    footerLeft: `Printed ${formatTimestamp(input.printedAt)}`,
  };
}

/** A CSS string literal, safe for `content:` (quotes, backslashes and line breaks escaped). */
// eslint-disable-next-line no-control-regex -- control characters are exactly what we escape
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function cssString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(CONTROL_CHARS, " ")}"`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const BOX_STYLE =
  'font-size: 8pt; color: #666; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;';

/** CSS page-margin boxes for the Print adapter (needs a recent Chromium; ignored otherwise). */
export function marginBoxCss(labels: PageLabels): string {
  return [
    "@page {",
    `  @top-left { content: ${cssString(labels.headerLeft)}; ${BOX_STYLE} vertical-align: bottom; }`,
    `  @top-right { content: ${cssString(labels.headerRight)}; ${BOX_STYLE} vertical-align: bottom; }`,
    `  @bottom-left { content: ${cssString(labels.footerLeft)}; ${BOX_STYLE} vertical-align: top; }`,
    `  @bottom-right { content: "Page " counter(page) " of " counter(pages); ${BOX_STYLE} vertical-align: top; }`,
    "}",
  ].join("\n");
}

/**
 * Header and footer templates for Electron's printToPDF. Chromium fills the elements with
 * class "pageNumber" and "totalPages". Templates need explicit font sizes (the default is 0).
 */
export function pdfTemplates(
  labels: PageLabels,
  marginsIn: number,
): { header: string; footer: string } {
  const row = (left: string, right: string): string =>
    `<div style="width: 100%; font-size: 8pt; color: #666; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; ` +
    `padding: 0 ${marginsIn}in; display: flex; justify-content: space-between;">` +
    `<span>${left}</span><span>${right}</span></div>`;
  return {
    header: row(escapeHtml(labels.headerLeft), escapeHtml(labels.headerRight)),
    footer: row(
      escapeHtml(labels.footerLeft),
      'Page <span class="pageNumber"></span> of <span class="totalPages"></span>',
    ),
  };
}
