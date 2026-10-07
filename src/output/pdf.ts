import { uniqueFilename } from "../core/filename";
import { pdfTemplates } from "../core/header-footer";
import {
  pageCss,
  type OutputAdapter,
  type OutputOptions,
  type OutputResult,
  type RenderedDocument,
} from "./adapter";

/**
 * One-click PDF adapter (SPEC 3.6). Renders the document in a hidden Electron window
 * (through the bridge), checks the `%PDF-` header and writes the file to the vault, the Desktop
 * or a place chosen in the macOS Save panel. It never overwrites without confirmation: vault and
 * Desktop saves append " (2)", and the Save panel asks before replacing. Everything environment-specific is injected, so the adapter is tested
 * with fakes. When it fails, the caller falls back to the Print adapter (runWithFallback).
 */

export interface PdfBridge {
  capability(): { ok: boolean; reason?: string };
  render(
    htmlAbsPath: string,
    opts: {
      pageSize: "Letter" | "A4";
      landscape: boolean;
      marginsIn: number;
      timeoutMs: number;
      /** HTML header and footer templates (Chromium fills .pageNumber and .totalPages). */
      headerFooter?: { header: string; footer: string };
    },
  ): Promise<Uint8Array>;
  open(absPath: string): Promise<void>;
  desktopDir(): string;
  /** macOS Save panel; null when cancelled. */
  askSavePath(defaultPath: string): Promise<string | null>;
  localExists(absPath: string): boolean;
  writeLocal(absPath: string, data: Uint8Array): Promise<void>;
}

export interface PdfIo {
  /** Full HTML document for the rendered content, with `css` inlined and images as data URIs. */
  serialize(doc: RenderedDocument, css: string): Promise<string>;
  /** Write a temporary HTML file inside the vault's plugin folder. */
  writeTemp(html: string): Promise<{ absPath: string; cleanup: () => Promise<void> }>;
  /** True when a file exists at the vault path (case-insensitive, as on macOS). */
  exists(vaultPath: string): boolean;
  ensureFolder(folder: string): Promise<void>;
  writePdf(vaultPath: string, data: Uint8Array): Promise<void>;
  /** Absolute file system path, or null when the vault is not on the local disk. */
  absolutePath(vaultPath: string): string | null;
}

export const PDF_TIMEOUT_MS = 30000;

export function isPdf(data: Uint8Array): boolean {
  return data.length >= 5 && String.fromCharCode(...Array.from(data.subarray(0, 5))) === "%PDF-";
}

export class PdfAdapter implements OutputAdapter {
  readonly id = "pdf" as const;
  readonly label = "PDF";
  readonly action = "Save PDF";

  constructor(
    private readonly bridge: PdfBridge,
    private readonly io: PdfIo,
    /** The shared print stylesheet. */
    private readonly css: string,
  ) {}

  isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    return Promise.resolve(this.bridge.capability());
  }

  async run(doc: RenderedDocument, opts: OutputOptions): Promise<OutputResult> {
    const target = opts.target;
    if (!target) throw new Error("no file name was given for the PDF");

    // Decide where to save first, so cancelling the Save panel costs nothing.
    let local: string | null = null;
    if (target.kind === "desktop") {
      local = uniqueFilename(`${this.bridge.desktopDir()}/${target.name}`, "pdf", (p) =>
        this.bridge.localExists(p),
      );
    } else if (target.kind === "ask") {
      const chosen = await this.bridge.askSavePath(
        `${this.bridge.desktopDir()}/${target.name}.pdf`,
      );
      if (chosen === null) return { ok: false, cancelled: true, message: "Save cancelled." };
      local = /\.pdf$/i.test(chosen) ? chosen : `${chosen}.pdf`;
    }

    const html = await this.io.serialize(doc, `${this.css}\n${pageCss(opts)}`);
    const temp = await this.io.writeTemp(html);
    let data: Uint8Array;
    try {
      data = await this.bridge.render(temp.absPath, {
        pageSize: opts.paper === "a4" ? "A4" : "Letter",
        landscape: opts.orientation === "landscape",
        marginsIn: opts.marginsIn,
        timeoutMs: PDF_TIMEOUT_MS,
        ...(opts.labels ? { headerFooter: pdfTemplates(opts.labels, opts.marginsIn) } : {}),
      });
    } finally {
      await temp.cleanup();
    }
    if (!isPdf(data)) throw new Error("the generated file is not a valid PDF");

    let path: string;
    let abs: string | null;
    if (local !== null) {
      await this.bridge.writeLocal(local, data);
      path = local;
      abs = local;
    } else if (target.kind === "vault") {
      await this.io.ensureFolder(target.folder);
      const base = target.folder ? `${target.folder}/${target.name}` : target.name;
      path = uniqueFilename(base, "pdf", (p) => this.io.exists(p));
      await this.io.writePdf(path, data);
      abs = this.io.absolutePath(path);
    } else {
      throw new Error("no destination for the PDF");
    }

    let message = `Saved ${path}`;
    if (target.openAfter) {
      try {
        if (!abs) throw new Error("the vault is not on the local disk");
        await this.bridge.open(abs);
      } catch (err) {
        message += ` (could not open it: ${err instanceof Error ? err.message : String(err)})`;
      }
    }
    return { ok: true, message, path };
  }
}
