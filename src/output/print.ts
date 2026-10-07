import printCss from "../../print.css";
import {
  NEUTRAL_CLASS,
  PRINT_BODY_CLASS,
  PRINT_CLEANUP_TIMEOUT_MS,
  PRINT_FRAME_CLASS,
} from "../constants";
import { marginBoxCss } from "../core/header-footer";
import type { Logger } from "../logger";
import {
  pageCss,
  type OutputAdapter,
  type OutputOptions,
  type OutputResult,
  type RenderedDocument,
} from "./adapter";

const IMAGE_TIMEOUT_MS = 5000;

/**
 * Print adapter (SPEC 3.6): hidden, sandboxed iframe in the Obsidian window, then print().
 * No Electron APIs and no scripts in the iframe (sandbox without allow-scripts).
 * Verified on Brian's Mac via Spike A (A1-A3, 2026-10-07).
 */
export class PrintAdapter implements OutputAdapter {
  readonly id = "print" as const;
  readonly label = "Print";
  readonly action = "Print";
  /** Cleanup of the previous print. A new print means the previous print panel has closed. */
  private previous: (() => void) | null = null;

  constructor(
    private readonly log: Logger,
    /** Pending cleanups; the plugin runs them on unload so no iframe outlives it. */
    private readonly pending: Set<() => void>,
  ) {}

  isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    return Promise.resolve({ ok: true });
  }

  async run(doc: RenderedDocument, opts: OutputOptions): Promise<OutputResult> {
    this.previous?.();

    const frame = createEl("iframe", { cls: PRINT_FRAME_CLASS });
    frame.setAttribute("aria-hidden", "true");
    // Set before insertion so it applies to the initial document.
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    document.body.appendChild(frame);
    const originalTitle = document.title;
    let cleaned = false;
    let timer: number | undefined;

    const cleanup = (reason: string): void => {
      if (cleaned) return;
      cleaned = true;
      this.pending.delete(onUnload);
      if (timer !== undefined) window.clearTimeout(timer);
      document.title = originalTitle;
      frame.remove();
      if (this.previous === onUnload) this.previous = null;
      this.log.debug(`print cleanup (${reason})`);
    };
    const onUnload = (): void => cleanup("plugin unload");
    this.pending.add(onUnload);
    this.previous = onUnload;

    try {
      const iframeDoc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!iframeDoc || !win) throw new Error("the print frame has no document");

      // Styles go in as constructed stylesheets of the iframe's own window; no <style> elements.
      const sheet = new (win as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet();
      const margins = opts.labels ? marginBoxCss(opts.labels) : "";
      sheet.replaceSync(
        `${doc.matchTheme ? themeCss() : ""}\n${printCss}\n${pageCss(opts)}\n${margins}`,
      );
      iframeDoc.adoptedStyleSheets = [sheet];
      // Build the content in the main window (createEl is only patched there), then import.
      const wrapper = createDiv();
      wrapper.appendChild(doc.content.cloneNode(true));

      iframeDoc.title = doc.title;
      iframeDoc.body.classList.add(PRINT_BODY_CLASS);
      if (doc.matchTheme) iframeDoc.body.classList.add(...Array.from(document.body.classList));
      else iframeDoc.body.classList.add(NEUTRAL_CLASS);
      iframeDoc.body.appendChild(iframeDoc.importNode(wrapper, true));

      await waitForImages(iframeDoc);

      win.addEventListener("afterprint", () => cleanup("afterprint"));
      timer = window.setTimeout(() => cleanup("timeout"), PRINT_CLEANUP_TIMEOUT_MS);
      // The macOS PDF dropdown proposes a filename from the top window's title.
      document.title = doc.title;
      win.focus();
      const started = performance.now();
      win.print();
      this.log.debug(`print() returned after ${Math.round(performance.now() - started)} ms`);
      return { ok: true };
    } catch (err) {
      cleanup("error");
      throw err;
    }
  }
}

/** The CSS currently applied to the Obsidian window (theme and snippets), for "Match theme". */
export function themeCss(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) parts.push(rule.cssText);
    } catch {
      // Cross-origin sheets cannot be read; skip them.
    }
  }
  return parts.join("\n");
}

function waitForImages(doc: Document): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  const loads = pending.map(
    (img) =>
      new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }),
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_TIMEOUT_MS));
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}
