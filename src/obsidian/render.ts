import { App, Component, MarkdownRenderer } from "obsidian";
import { RENDER_HOST_CLASS, RENDER_QUIET_MS, RENDER_TIMEOUT_MS } from "../constants";
import { propertyDisplay, type PrintJob } from "../core/job";

export interface RenderResult {
  /** Rendered, script-free document content (title, properties, body). */
  content: HTMLElement;
  /** True when async content was still changing at the hard timeout. */
  timedOut: boolean;
  /** Unload rendered components and remove the off-screen host. Always call it. */
  dispose(): void;
}

/**
 * Render a print job with Obsidian's renderer, off screen but attached to the document so
 * Dataview, Bases, Mermaid and MathJax can lay out. Waits until the DOM is quiet for
 * RENDER_QUIET_MS, or RENDER_TIMEOUT_MS at most (SPEC 3.5).
 */
export async function renderJob(
  app: App,
  job: PrintJob,
  sourcePath: string,
): Promise<RenderResult> {
  const host = document.body.createDiv({ cls: RENDER_HOST_CLASS });
  const component = new Component();
  component.load();
  const dispose = (): void => {
    component.unload();
    host.remove();
  };

  try {
    const content = host.createDiv({
      cls: "markdown-preview-view markdown-rendered selective-print-content",
    });
    if (job.title !== null)
      content.createEl("h1", { text: job.title, cls: "selective-print-title" });
    if (job.properties.length) {
      const table = content.createEl("table", { cls: "selective-print-properties" });
      for (const [name, value] of job.properties) {
        const row = table.createEl("tr");
        row.createEl("th", { text: name });
        row.createEl("td", { text: propertyDisplay(value) });
      }
    }
    const body = content.createDiv();
    await MarkdownRenderer.render(app, job.markdown, body, sourcePath, component);
    const timedOut = await waitForQuiet(content, RENDER_QUIET_MS, RENDER_TIMEOUT_MS);
    stripActiveContent(content);
    return { content, timedOut, dispose };
  } catch (err) {
    dispose();
    throw err;
  }
}

/** Resolve once `el` has had no DOM changes for `quietMs`; true if `timeoutMs` hit first. */
function waitForQuiet(el: HTMLElement, quietMs: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let quietTimer = window.setTimeout(() => finish(false), quietMs);
    const hardTimer = window.setTimeout(() => finish(true), timeoutMs);
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => finish(false), quietMs);
    });
    observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    function finish(timedOut: boolean): void {
      observer.disconnect();
      window.clearTimeout(quietTimer);
      window.clearTimeout(hardTimer);
      resolve(timedOut);
    }
  });
}

/** Remove scripts and inline event handlers before content enters the print document. */
function stripActiveContent(root: HTMLElement): void {
  root.querySelectorAll("script").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || (name === "href" && /^\s*javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  });
}
