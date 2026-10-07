import { describe, expect, it } from "vitest";
import {
  cssString,
  escapeHtml,
  formatTimestamp,
  marginBoxCss,
  noteLocation,
  pageLabels,
  pdfTemplates,
} from "../src/core/header-footer";

const printedAt = new Date(2026, 9, 7, 14, 5);
const modifiedAt = new Date(2026, 9, 6, 9, 12);

describe("header and footer labels", () => {
  it("location, printed time and last modified", () => {
    expect(pageLabels({ path: "Meetings/2026/Weekly Sync.md", printedAt, modifiedAt })).toEqual({
      headerLeft: "Meetings/2026/Weekly Sync",
      headerRight: "Last modified 2026-10-06 09:12",
      footerLeft: "Printed 2026-10-07 14:05",
    });
  });

  it("root notes, missing or invalid modified time", () => {
    expect(noteLocation("Top.md")).toBe("Top");
    expect(pageLabels({ path: "Top.md", printedAt, modifiedAt: null }).headerRight).toBe(
      "Last modified unknown",
    );
    expect(pageLabels({ path: "Top.md", printedAt, modifiedAt: new Date("x") }).headerRight).toBe(
      "Last modified unknown",
    );
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02 03:04");
  });
});

describe("escaping", () => {
  it("CSS strings escape quotes, backslashes and control characters", () => {
    expect(cssString('A "quoted" \\ path\nnext')).toBe('"A \\"quoted\\" \\\\ path next"');
  });

  it("HTML escapes markup", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      "&#60;b&#62;&#34;x&#34; &#38; &#39;y&#39;&#60;/b&#62;",
    );
  });
});

describe("print and PDF output", () => {
  const labels = pageLabels({ path: 'Notes/"Q3" <plan>.md', printedAt, modifiedAt });

  it("margin boxes for the print panel, with page X of Y", () => {
    const css = marginBoxCss(labels);
    expect(css).toContain('@top-left { content: "Notes/\\"Q3\\" <plan>";');
    expect(css).toContain('@top-right { content: "Last modified 2026-10-06 09:12";');
    expect(css).toContain('@bottom-left { content: "Printed 2026-10-07 14:05";');
    expect(css).toContain('@bottom-right { content: "Page " counter(page) " of " counter(pages);');
  });

  it("PDF templates escape values and use Chromium's page number classes", () => {
    const t = pdfTemplates(labels, 0.75);
    expect(t.header).toContain(
      "<span>Notes/&#34;Q3&#34; &#60;plan&#62;</span><span>Last modified 2026-10-06 09:12</span>",
    );
    expect(t.header).toContain("padding: 0 0.75in");
    expect(t.footer).toContain(
      '<span>Printed 2026-10-07 14:05</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>',
    );
    expect(t.header).not.toContain("<plan>");
  });
});
