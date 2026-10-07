import { App, Component, MarkdownRenderer, Notice } from "obsidian";
import printCss from "../../print.css";
import { PRINT_BODY_CLASS, PRINT_CLEANUP_TIMEOUT_MS, PRINT_FRAME_CLASS } from "../constants";
import type { Logger } from "../logger";

/**
 * Spike A (M0): render a hardcoded, fictional note into a hidden iframe and call print().
 * Answers: does the macOS print panel open from an iframe inside Obsidian, does the
 * "PDF" dropdown work, and what filename does it propose. Replaced by the Print adapter in M2.
 */

export const SPIKE_TITLE = "Spike A - Fictional Weekly Sync";

const SPIKE_MARKDOWN = `# Fictional Weekly Sync

Preamble paragraph before the first section.

## Agenda
- Review the Contoso pilot timeline
- Budget check

## Notes
Some **bold**, some *italic*, a [[Wikilink]] and \`inline code\`.

| Item | Owner | Due |
|---|---|---|
| Draft plan | Alex Example | 2026-10-10 |

> [!note] A callout
> Callouts should print with a left border.

\`\`\`ts
// A code block
const answer = 42;
\`\`\`

## Action items
- [ ] Send recap
- [x] Book room

## Transcript
Speaker 1: This section will be excluded by default once the review dialog exists (M2).
`;

/** Remove anything executable from rendered content before it enters the print document. */
function stripScripts(root: HTMLElement): void {
  root.querySelectorAll("script").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
    }
  });
}

export interface PrintSpikeOptions {
  /** Sandbox the iframe (no allow-scripts). The no-sandbox variant isolates sandbox effects. */
  sandbox: boolean;
  /** Pending cleanups; the plugin runs them all on unload so no iframe outlives it. */
  pending: Set<() => void>;
}

export async function runPrintSpike(app: App, log: Logger, opts: PrintSpikeOptions): Promise<void> {
  const component = new Component();
  component.load();
  const frame = createEl("iframe", { cls: PRINT_FRAME_CLASS });
  frame.setAttribute("aria-hidden", "true");
  if (opts.sandbox) {
    // Set before insertion so it applies to the initial document. No allow-scripts:
    // nothing in the print document can execute.
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  }
  document.body.appendChild(frame);
  const originalTitle = document.title;
  let cleaned = false;
  let timer: number | undefined;

  const cleanup = (reason: string): void => {
    if (cleaned) return;
    cleaned = true;
    opts.pending.delete(onUnload);
    if (timer !== undefined) window.clearTimeout(timer);
    document.title = originalTitle;
    frame.remove();
    component.unload();
    log.debug(`Spike A cleanup (${reason})`);
  };

  const onUnload = (): void => cleanup("plugin unload");
  opts.pending.add(onUnload);

  try {
    const container = createDiv();
    await MarkdownRenderer.render(app, SPIKE_MARKDOWN, container, "", component);
    stripScripts(container);
    // The stylesheet travels with the content; createEl is only patched in the main window.
    container.prepend(createEl("style", { text: printCss }));

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error("print iframe has no document");

    doc.title = SPIKE_TITLE;
    doc.body.classList.add(PRINT_BODY_CLASS);
    doc.body.appendChild(doc.importNode(container, true));

    win.addEventListener("afterprint", () => cleanup("afterprint"));
    timer = window.setTimeout(() => cleanup("timeout"), PRINT_CLEANUP_TIMEOUT_MS);

    // The macOS PDF dropdown proposes a filename from the top window's title.
    document.title = SPIKE_TITLE;
    log.debug(`Spike A calling print() (sandbox: ${String(opts.sandbox)})`);
    win.focus();
    win.print();
    log.debug("Spike A print() returned");
  } catch (err) {
    log.error("Spike A failed", err);
    new Notice(`Selective Print spike A failed: ${String(err)}`);
    cleanup("error");
  }
}
