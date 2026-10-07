/**
 * The only module allowed to touch Electron (CLAUDE.md section 7). Everything here is
 * capability-detected: Electron `remote` is deprecated upstream and may disappear in any
 * Obsidian release, so callers must handle `ok: false` and fall back to the Print adapter.
 *
 * Used by "Show diagnostics" (capabilities, in-memory probe) and by the PDF adapter (M4):
 * a hidden BrowserWindow with JavaScript disabled renders a local HTML file to PDF.
 */

/** Minimal structural types for the parts of Electron we probe. Not the real typings. */
interface WebContentsLike {
  printToPDF?: (options: Record<string, unknown>) => Promise<Uint8Array>;
}
interface WindowLike {
  webContents: WebContentsLike;
  loadFile(path: string): Promise<void>;
  destroy(): void;
  isDestroyed(): boolean;
}
type BrowserWindowCtor = new (options: Record<string, unknown>) => WindowLike;
interface ShellLike {
  openPath?: (path: string) => Promise<string>;
}
interface RemoteLike {
  BrowserWindow?: unknown;
  getCurrentWebContents?: () => WebContentsLike;
  shell?: ShellLike;
}
interface ElectronLike {
  remote?: RemoteLike;
  shell?: ShellLike;
}

export interface ElectronCapabilities {
  /** `window.require("electron")` returned a module. */
  electron: boolean;
  /** Where `remote` came from, or null when unavailable. */
  remoteSource: "electron.remote" | "@electron/remote" | null;
  /** `remote.BrowserWindow` is a constructor. */
  browserWindow: boolean;
  /** The current window's webContents exposes `printToPDF`. */
  printToPDF: boolean;
  versions: { electron?: string; chrome?: string; node?: string };
  /** Human-readable reasons for each missing capability. */
  problems: string[];
}

type NodeRequire = (id: string) => unknown;

function getRequire(): NodeRequire | null {
  const req = (window as unknown as { require?: unknown }).require;
  return typeof req === "function" ? (req as NodeRequire) : null;
}

function tryRequire(req: NodeRequire, id: string): unknown {
  try {
    return req(id);
  } catch {
    return null;
  }
}

function getRemote(req: NodeRequire): {
  remote: RemoteLike | null;
  source: ElectronCapabilities["remoteSource"];
} {
  const electron = tryRequire(req, "electron") as ElectronLike | null;
  if (electron?.remote) return { remote: electron.remote, source: "electron.remote" };
  const standalone = tryRequire(req, "@electron/remote") as RemoteLike | null;
  if (standalone && typeof standalone === "object")
    return { remote: standalone, source: "@electron/remote" };
  return { remote: null, source: null };
}

function readVersions(): ElectronCapabilities["versions"] {
  const proc = (
    window as unknown as { process?: { versions?: Record<string, string | undefined> } }
  ).process;
  const v = proc?.versions ?? {};
  return { electron: v.electron, chrome: v.chrome, node: v.node };
}

export function detectElectronCapabilities(): ElectronCapabilities {
  const caps: ElectronCapabilities = {
    electron: false,
    remoteSource: null,
    browserWindow: false,
    printToPDF: false,
    versions: readVersions(),
    problems: [],
  };

  const req = getRequire();
  if (!req) {
    caps.problems.push("window.require is not available (not the Electron desktop app?)");
    return caps;
  }
  caps.electron = tryRequire(req, "electron") !== null;
  if (!caps.electron) {
    caps.problems.push('require("electron") failed');
    return caps;
  }

  const { remote, source } = getRemote(req);
  caps.remoteSource = source;
  if (!remote) {
    caps.problems.push(
      'Electron "remote" is unavailable (neither electron.remote nor @electron/remote)',
    );
    return caps;
  }

  caps.browserWindow = typeof remote.BrowserWindow === "function";
  if (!caps.browserWindow) caps.problems.push("remote.BrowserWindow is not a constructor");

  try {
    const wc = remote.getCurrentWebContents?.();
    caps.printToPDF = typeof wc?.printToPDF === "function";
  } catch (err) {
    caps.problems.push(`remote.getCurrentWebContents() threw: ${String(err)}`);
  }
  if (!caps.printToPDF) caps.problems.push("webContents.printToPDF is not available");

  return caps;
}

export interface PrintToPdfProbe {
  ok: boolean;
  /** Size of the generated PDF in bytes. The bytes are discarded, never written. */
  bytes?: number;
  /** True when the result starts with `%PDF-`. */
  pdfHeader?: boolean;
  error?: string;
}

/**
 * Spike B probe: ask the current window's webContents for a PDF in memory and check
 * the header. Nothing is written to disk and no window is created.
 */
export async function probePrintToPdf(): Promise<PrintToPdfProbe> {
  const req = getRequire();
  if (!req) return { ok: false, error: "window.require is not available" };
  const { remote } = getRemote(req);
  if (!remote) return { ok: false, error: 'Electron "remote" is unavailable' };
  try {
    const wc = remote.getCurrentWebContents?.();
    if (typeof wc?.printToPDF !== "function") {
      return { ok: false, error: "webContents.printToPDF is not available" };
    }
    const data = await wc.printToPDF({});
    const header = String.fromCharCode(...Array.from(data.subarray(0, 5)));
    return { ok: true, bytes: data.byteLength, pdfHeader: header === "%PDF-" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Whether one-click PDF can run: `remote.BrowserWindow` must be a constructor. */
export function pdfCapability(): { ok: boolean; reason?: string } {
  const req = getRequire();
  if (!req) return { ok: false, reason: "Electron is not available" };
  const { remote } = getRemote(req);
  if (!remote)
    return { ok: false, reason: 'Electron "remote" is not available in this Obsidian version' };
  if (typeof remote.BrowserWindow !== "function")
    return { ok: false, reason: "remote.BrowserWindow is not available" };
  return { ok: true };
}

export interface PdfRenderOptions {
  pageSize: "Letter" | "A4";
  landscape: boolean;
  marginsIn: number;
  timeoutMs: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${what} timed out after ${ms / 1000} s`)),
      ms,
    );
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Render a local HTML file to PDF in a hidden window with JavaScript disabled and no Node
 * access. The window is always destroyed.
 */
export async function renderHtmlFileToPdf(
  absPath: string,
  opts: PdfRenderOptions,
): Promise<Uint8Array> {
  const req = getRequire();
  const remote = req ? getRemote(req).remote : null;
  if (!remote || typeof remote.BrowserWindow !== "function") {
    throw new Error('Electron "remote" is not available');
  }
  const Ctor = remote.BrowserWindow as BrowserWindowCtor;
  const win = new Ctor({
    show: false,
    width: 816,
    height: 1056,
    webPreferences: {
      javascript: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await withTimeout(win.loadFile(absPath), opts.timeoutMs, "loading the document");
    const print = win.webContents.printToPDF;
    if (typeof print !== "function") throw new Error("webContents.printToPDF is not available");
    const m = opts.marginsIn;
    return await withTimeout(
      print.call(win.webContents, {
        pageSize: opts.pageSize,
        landscape: opts.landscape,
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: m, bottom: m, left: m, right: m },
      }),
      opts.timeoutMs,
      "creating the PDF",
    );
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/** Open a file with its default macOS app (usually Preview for PDFs). */
export async function openPathExternally(absPath: string): Promise<void> {
  const req = getRequire();
  const electron = req ? (tryRequire(req, "electron") as ElectronLike | null) : null;
  const shell = electron?.shell ?? (req ? getRemote(req).remote?.shell : undefined);
  if (typeof shell?.openPath !== "function")
    throw new Error("cannot open files from Obsidian on this system");
  const error = await shell.openPath(absPath);
  if (error) throw new Error(error);
}
