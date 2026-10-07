import type { Orientation, PaperSize } from "../settings";

/** One output step (SPEC 3.6). New formats are new adapters; the pipeline does not change. */

export interface RenderedDocument {
  /** Used for the print document title, which the macOS PDF dropdown proposes as filename. */
  title: string;
  /** Rendered, script-free content in the main window. Adapters clone it; they never move it. */
  content: HTMLElement;
  /** Copy the active Obsidian theme instead of the neutral print style. */
  matchTheme: boolean;
}

export interface OutputOptions {
  paper: PaperSize;
  orientation: Orientation;
  marginsIn: number;
}

export interface OutputResult {
  ok: boolean;
  message?: string;
}

export interface OutputAdapter {
  id: "print" | "pdf" | "html" | "markdown";
  label: string;
  /** Label of the dialog's primary button, e.g. "Print". */
  action: string;
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  run(doc: RenderedDocument, opts: OutputOptions): Promise<OutputResult>;
}

/** CSS for page size, orientation and margins from settings; follows print.css so it wins. */
export function pageCss(opts: OutputOptions): string {
  const margin = Number.isFinite(opts.marginsIn) && opts.marginsIn >= 0 ? opts.marginsIn : 0.75;
  return `@page { size: ${opts.paper} ${opts.orientation}; margin: ${margin}in; }`;
}
