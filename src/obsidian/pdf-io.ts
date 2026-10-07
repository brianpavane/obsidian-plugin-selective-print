import { App, arrayBufferToBase64, FileSystemAdapter, normalizePath, TFolder } from "obsidian";
import { NEUTRAL_CLASS, PRINT_BODY_CLASS } from "../constants";
import type { RenderedDocument } from "../output/adapter";
import type { PdfIo } from "../output/pdf";
import { themeCss } from "../output/print";

const TEMP_PREFIX = ".print-tmp-";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

/**
 * File and DOM operations for the PDF adapter. The temporary HTML file lives in the plugin's
 * own folder inside the vault (never outside it) and is removed after every run; leftovers
 * from a crash are removed on the next load.
 */
export class VaultPdfIo implements PdfIo {
  constructor(
    private readonly app: App,
    /** Vault path of the plugin folder (manifest.dir). */
    private readonly pluginDir: string,
  ) {}

  async serialize(doc: RenderedDocument, css: string): Promise<string> {
    const clone = doc.content.cloneNode(true) as HTMLElement;
    for (const img of Array.from(clone.querySelectorAll("img"))) {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      const data = await this.vaultImageAsDataUri(src);
      if (data) img.setAttribute("src", data);
    }
    const styles = `${doc.matchTheme ? themeCss() : ""}\n${css}`.replace(/<\/style/gi, "<\\/style");
    const bodyClasses = doc.matchTheme
      ? [PRINT_BODY_CLASS, ...Array.from(document.body.classList)]
      : [PRINT_BODY_CLASS, NEUTRAL_CLASS];
    return (
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>` +
      `<style>${styles}</style></head><body class="${escapeHtml(bodyClasses.join(" "))}">` +
      `${clone.outerHTML}</body></html>`
    );
  }

  /**
   * Inline a vault image (rendered as an app:// resource URL) as a data URI, so the PDF window
   * needs no access to Obsidian's resources. Other images are left as they are.
   */
  private async vaultImageAsDataUri(src: string): Promise<string | null> {
    if (!src.startsWith("app://")) return null;
    try {
      const abs = decodeURIComponent(new URL(src).pathname);
      const base = this.basePath();
      if (!abs.startsWith(`${base}/`)) return null;
      const rel = normalizePath(abs.slice(base.length + 1));
      const mime = MIME[(rel.split(".").pop() ?? "").toLowerCase()];
      if (!mime) return null;
      const data = await this.app.vault.adapter.readBinary(rel);
      return `data:${mime};base64,${arrayBufferToBase64(data)}`;
    } catch {
      return null;
    }
  }

  private basePath(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter))
      throw new Error("the vault is not on the local disk");
    return adapter.getBasePath();
  }

  async writeTemp(html: string): Promise<{ absPath: string; cleanup: () => Promise<void> }> {
    const name = `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`;
    const path = normalizePath(`${this.pluginDir}/${name}`);
    const absPath = `${this.basePath()}/${path}`;
    await this.app.vault.adapter.write(path, html);
    return {
      absPath,
      cleanup: async () => {
        try {
          await this.app.vault.adapter.remove(path);
        } catch {
          // Already gone; removeStaleTemp catches anything left behind.
        }
      },
    };
  }

  /** Remove temporary files left behind by a crash. */
  async removeStaleTemp(): Promise<void> {
    try {
      const listing = await this.app.vault.adapter.list(normalizePath(this.pluginDir));
      for (const file of listing.files) {
        if ((file.split("/").pop() ?? "").startsWith(TEMP_PREFIX))
          await this.app.vault.adapter.remove(file);
      }
    } catch {
      // Plugin folder not listable (for example during development); nothing to clean.
    }
  }

  exists(vaultPath: string): boolean {
    const path = normalizePath(vaultPath);
    if (this.app.vault.getAbstractFileByPath(path)) return true;
    // macOS file systems are case-insensitive: "Note.pdf" and "note.pdf" are the same file.
    const slash = path.lastIndexOf("/");
    const parent =
      slash === -1
        ? this.app.vault.getRoot()
        : this.app.vault.getAbstractFileByPath(path.slice(0, slash));
    if (!(parent instanceof TFolder)) return false;
    const name = path.slice(slash + 1).toLowerCase();
    return parent.children.some((c) => c.name.toLowerCase() === name);
  }

  async ensureFolder(folder: string): Promise<void> {
    if (folder === "" || this.app.vault.getFolderByPath(folder)) return;
    await this.app.vault.createFolder(folder);
  }

  async writePdf(vaultPath: string, data: Uint8Array): Promise<void> {
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    await this.app.vault.createBinary(normalizePath(vaultPath), buffer);
  }

  absolutePath(vaultPath: string): string | null {
    try {
      return `${this.basePath()}/${normalizePath(vaultPath)}`;
    } catch {
      return null;
    }
  }
}
