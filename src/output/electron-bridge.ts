/**
 * The only module allowed to touch Electron (CLAUDE.md section 7). Everything here is
 * capability-detected: Electron `remote` is deprecated upstream and may disappear in any
 * Obsidian release, so callers must handle `ok: false` and fall back to the Print adapter.
 *
 * M0 (Spike B) only detects capabilities and runs an in-memory printToPDF probe.
 * The PDF adapter itself is M4.
 */

/** Minimal structural types for the parts of Electron we probe. Not the real typings. */
interface WebContentsLike {
  printToPDF?: (options: Record<string, unknown>) => Promise<Uint8Array>;
}
interface RemoteLike {
  BrowserWindow?: unknown;
  getCurrentWebContents?: () => WebContentsLike;
}
interface ElectronLike {
  remote?: RemoteLike;
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
