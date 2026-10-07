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
  /** Where file-producing adapters save: vault folder ("" = vault root) and name without extension. */
  target?: { folder: string; name: string; openAfter: boolean };
}

export interface OutputResult {
  ok: boolean;
  message?: string;
  /** Vault path of the written file, for file-producing adapters. */
  path?: string;
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

export interface AdapterAvailability {
  available: OutputAdapter[];
  unavailable: { adapter: OutputAdapter; reason: string }[];
}

/** Ask every adapter whether it can run. An adapter that throws counts as unavailable. */
export async function checkAdapters(
  adapters: readonly OutputAdapter[],
): Promise<AdapterAvailability> {
  const result: AdapterAvailability = { available: [], unavailable: [] };
  for (const adapter of adapters) {
    try {
      const status = await adapter.isAvailable();
      if (status.ok) result.available.push(adapter);
      else result.unavailable.push({ adapter, reason: status.reason ?? "not available" });
    } catch (err) {
      result.unavailable.push({
        adapter,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

/**
 * Run `primary`; if it fails (result not ok, or throws), tell the user why and run `fallback`
 * (SPEC 3.6: never fail silently). With no fallback, the failure is returned.
 */
export async function runWithFallback(
  primary: OutputAdapter,
  fallback: OutputAdapter | null,
  doc: RenderedDocument,
  opts: OutputOptions,
  notify: (message: string) => void,
): Promise<OutputResult> {
  let reason: string;
  try {
    const result = await primary.run(doc, opts);
    if (result.ok) return result;
    reason = result.message ?? "unknown error";
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  if (!fallback || fallback === primary)
    return { ok: false, message: `${primary.label} failed: ${reason}` };
  notify(
    `${primary.label} failed: ${reason}. Opening the ${fallback.label.toLowerCase()} dialog instead.`,
  );
  return fallback.run(doc, opts);
}
