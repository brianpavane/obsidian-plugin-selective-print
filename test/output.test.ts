import { describe, expect, it, vi } from "vitest";
import {
  checkAdapters,
  pageCss,
  runWithFallback,
  type OutputAdapter,
  type OutputOptions,
  type RenderedDocument,
} from "../src/output/adapter";
import { isPdf, PdfAdapter, type PdfBridge, type PdfIo } from "../src/output/pdf";

const doc = {
  title: "Weekly Sync",
  content: {} as HTMLElement,
  matchTheme: false,
} satisfies RenderedDocument;
const opts: OutputOptions = {
  paper: "letter",
  orientation: "portrait",
  marginsIn: 0.75,
  target: { kind: "vault", folder: "Exports", name: "2026-10-07 - Weekly Sync", openAfter: false },
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"

function fakeAdapter(
  id: OutputAdapter["id"],
  behavior: "ok" | "fail" | "throw" | "unavailable",
): OutputAdapter {
  return {
    id,
    label: id === "pdf" ? "PDF" : "Print",
    action: id,
    isAvailable: () =>
      behavior === "unavailable"
        ? Promise.resolve({ ok: false, reason: "no remote" })
        : Promise.resolve({ ok: true }),
    run: vi.fn(() => {
      if (behavior === "throw") return Promise.reject(new Error("boom"));
      return Promise.resolve(behavior === "ok" ? { ok: true } : { ok: false, message: "bad" });
    }),
  };
}

describe("adapter registry", () => {
  it("splits available and unavailable adapters, with reasons", async () => {
    const throwing: OutputAdapter = {
      ...fakeAdapter("html", "ok"),
      isAvailable: () => Promise.reject(new Error("x")),
    };
    const r = await checkAdapters([
      fakeAdapter("print", "ok"),
      fakeAdapter("pdf", "unavailable"),
      throwing,
    ]);
    expect(r.available.map((a) => a.id)).toEqual(["print"]);
    expect(r.unavailable.map((u) => [u.adapter.id, u.reason])).toEqual([
      ["pdf", "no remote"],
      ["html", "x"],
    ]);
  });

  it("page CSS from options, with a safe margin fallback", () => {
    expect(pageCss(opts)).toBe("@page { size: letter portrait; margin: 0.75in; }");
    expect(pageCss({ ...opts, paper: "a4", orientation: "landscape", marginsIn: Number.NaN })).toBe(
      "@page { size: a4 landscape; margin: 0.75in; }",
    );
  });
});

describe("runWithFallback", () => {
  it("returns the primary result when it succeeds", async () => {
    const notify = vi.fn();
    const print = fakeAdapter("print", "ok");
    expect(await runWithFallback(fakeAdapter("pdf", "ok"), print, doc, opts, notify)).toEqual({
      ok: true,
    });
    expect(notify).not.toHaveBeenCalled();
    expect(print.run).not.toHaveBeenCalled();
  });

  it.each(["fail", "throw"] as const)(
    "falls back to print with a notice when PDF %ss",
    async (how) => {
      const notify = vi.fn();
      const print = fakeAdapter("print", "ok");
      expect(await runWithFallback(fakeAdapter("pdf", how), print, doc, opts, notify)).toEqual({
        ok: true,
      });
      expect(notify).toHaveBeenCalledWith(
        `PDF failed: ${how === "throw" ? "boom" : "bad"}. Opening the print dialog instead.`,
      );
      expect(print.run).toHaveBeenCalledOnce();
    },
  );

  it("reports failure when there is no fallback", async () => {
    const r = await runWithFallback(fakeAdapter("print", "throw"), null, doc, opts, vi.fn());
    expect(r).toEqual({ ok: false, message: "Print failed: boom" });
    const self = fakeAdapter("print", "fail");
    expect((await runWithFallback(self, self, doc, opts, vi.fn())).ok).toBe(false);
  });
});

function fakes(
  over: {
    render?: PdfBridge["render"];
    existing?: string[];
    abs?: string | null;
    open?: PdfBridge["open"];
    ask?: PdfBridge["askSavePath"];
    desktopFiles?: string[];
  } = {},
) {
  const local: [string, Uint8Array][] = [];
  const written: [string, Uint8Array][] = [];
  const cleaned: string[] = [];
  const folders: string[] = [];
  const bridge: PdfBridge = {
    capability: () => ({ ok: true }),
    render: over.render ?? (() => Promise.resolve(PDF)),
    open: over.open ?? vi.fn(() => Promise.resolve()),
    desktopDir: () => "/Users/alex/Desktop",
    askSavePath: over.ask ?? (() => Promise.resolve("/Users/alex/Documents/Chosen.pdf")),
    localExists: (p) => (over.desktopFiles ?? []).includes(p),
    writeLocal: (p, d) => {
      local.push([p, d]);
      return Promise.resolve();
    },
  };
  const existing = new Set((over.existing ?? []).map((p) => p.toLowerCase()));
  const io: PdfIo = {
    serialize: vi.fn((_d: RenderedDocument, css: string) =>
      Promise.resolve(`<html><style>${css}</style></html>`),
    ),
    writeTemp: () =>
      Promise.resolve({
        absPath: "/vault/.obsidian/plugins/selective-print/t.html",
        cleanup: () => {
          cleaned.push("t");
          return Promise.resolve();
        },
      }),
    exists: (p) => existing.has(p.toLowerCase()),
    ensureFolder: (f) => {
      folders.push(f);
      return Promise.resolve();
    },
    writePdf: (p, d) => {
      written.push([p, d]);
      return Promise.resolve();
    },
    absolutePath: (p) => (over.abs === undefined ? `/vault/${p}` : over.abs),
  };
  return { bridge, io, written, cleaned, folders, local };
}

const vaultTarget = {
  kind: "vault" as const,
  folder: "Exports",
  name: "2026-10-07 - Weekly Sync",
  openAfter: false,
};

describe("PdfAdapter: Desktop and Save panel", () => {
  it("Desktop: saves there and never overwrites", async () => {
    const f = fakes({ desktopFiles: ["/Users/alex/Desktop/N.pdf"] });
    const r = await new PdfAdapter(f.bridge, f.io, "").run(doc, {
      ...opts,
      target: { kind: "desktop", name: "N", openAfter: false },
    });
    expect(r).toMatchObject({ ok: true, path: "/Users/alex/Desktop/N (2).pdf" });
    expect(f.local[0]?.[0]).toBe("/Users/alex/Desktop/N (2).pdf");
    expect(f.written).toEqual([]);
  });

  it("Ask: the Save panel starts on the Desktop with the file name; the chosen path is used", async () => {
    const ask = vi.fn<PdfBridge["askSavePath"]>(() =>
      Promise.resolve("/Users/alex/Documents/Chosen"),
    );
    const f = fakes({ ask });
    const r = await new PdfAdapter(f.bridge, f.io, "").run(doc, {
      ...opts,
      target: { kind: "ask", name: "N", openAfter: true },
    });
    expect(ask).toHaveBeenCalledWith("/Users/alex/Desktop/N.pdf");
    expect(r).toMatchObject({ ok: true, path: "/Users/alex/Documents/Chosen.pdf" });
    expect(f.bridge.open).toHaveBeenCalledWith("/Users/alex/Documents/Chosen.pdf");
  });

  it("Ask: cancelling renders and writes nothing, and does not fall back to print", async () => {
    const render = vi.fn<PdfBridge["render"]>(() => Promise.resolve(PDF));
    const f = fakes({ ask: () => Promise.resolve(null), render });
    const pdf = new PdfAdapter(f.bridge, f.io, "");
    const askOpts = { ...opts, target: { kind: "ask" as const, name: "N", openAfter: false } };
    expect(await pdf.run(doc, askOpts)).toEqual({
      ok: false,
      cancelled: true,
      message: "Save cancelled.",
    });
    expect(render).not.toHaveBeenCalled();
    expect(f.local).toEqual([]);

    const print = fakeAdapter("print", "ok");
    const notify = vi.fn();
    const viaFallback = await runWithFallback(pdf, print, doc, askOpts, notify);
    expect(viaFallback.cancelled).toBe(true);
    expect(print.run).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("PdfAdapter", () => {
  it("writes a verified PDF to the target folder and cleans up the temp file", async () => {
    const f = fakes();
    const r = await new PdfAdapter(f.bridge, f.io, "body{}").run(doc, opts);
    expect(r).toEqual({
      ok: true,
      message: "Saved Exports/2026-10-07 - Weekly Sync.pdf",
      path: "Exports/2026-10-07 - Weekly Sync.pdf",
    });
    expect(f.written[0]?.[1]).toBe(PDF);
    expect(f.cleaned).toEqual(["t"]);
    expect(f.folders).toEqual(["Exports"]);
    expect(vi.mocked(f.io.serialize).mock.calls[0]?.[1]).toContain(
      "@page { size: letter portrait; margin: 0.75in; }",
    );
  });

  it("never overwrites: appends (2), (3), case-insensitively", async () => {
    const f = fakes({
      existing: [
        "Exports/2026-10-07 - weekly sync.pdf",
        "Exports/2026-10-07 - Weekly Sync (2).pdf",
      ],
    });
    const r = await new PdfAdapter(f.bridge, f.io, "").run(doc, opts);
    expect(r.path).toBe("Exports/2026-10-07 - Weekly Sync (3).pdf");
  });

  it("saves in the vault root when the folder is empty, and passes A4 landscape", async () => {
    const render = vi.fn<PdfBridge["render"]>(() => Promise.resolve(PDF));
    const f = fakes({ render });
    const r = await new PdfAdapter(f.bridge, f.io, "").run(doc, {
      ...opts,
      paper: "a4",
      orientation: "landscape",
      target: { kind: "vault", folder: "", name: "N", openAfter: false },
    });
    expect(r.path).toBe("N.pdf");
    expect(render.mock.calls[0]?.[1]).toMatchObject({
      pageSize: "A4",
      landscape: true,
      marginsIn: 0.75,
    });
  });

  it("rejects output that is not a PDF, still cleaning up, and writes nothing", async () => {
    const f = fakes({ render: () => Promise.resolve(new Uint8Array([0x3c, 0x68])) });
    await expect(new PdfAdapter(f.bridge, f.io, "").run(doc, opts)).rejects.toThrow(
      "not a valid PDF",
    );
    expect(f.cleaned).toEqual(["t"]);
    expect(f.written).toEqual([]);
  });

  it("cleans up when rendering throws", async () => {
    const f = fakes({ render: () => Promise.reject(new Error("remote gone")) });
    await expect(new PdfAdapter(f.bridge, f.io, "").run(doc, opts)).rejects.toThrow("remote gone");
    expect(f.cleaned).toEqual(["t"]);
  });

  it("requires a target", async () => {
    const f = fakes();
    await expect(
      new PdfAdapter(f.bridge, f.io, "").run(doc, { ...opts, target: undefined }),
    ).rejects.toThrow("no file name");
  });

  it("opens the PDF when asked; an open failure still counts as saved", async () => {
    const open = vi.fn(() => Promise.resolve());
    const f = fakes({ open });
    await new PdfAdapter(f.bridge, f.io, "").run(doc, {
      ...opts,
      target: { ...vaultTarget, openAfter: true },
    });
    expect(open).toHaveBeenCalledWith("/vault/Exports/2026-10-07 - Weekly Sync.pdf");

    const g = fakes({ open: () => Promise.reject(new Error("no app")) });
    const r = await new PdfAdapter(g.bridge, g.io, "").run(doc, {
      ...opts,
      target: { ...vaultTarget, openAfter: true },
    });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/could not open it: no app/);

    const h = fakes({ abs: null });
    const r2 = await new PdfAdapter(h.bridge, h.io, "").run(doc, {
      ...opts,
      target: { ...vaultTarget, openAfter: true },
    });
    expect(r2.message).toMatch(/not on the local disk/);
  });

  it("availability comes from the bridge", async () => {
    const f = fakes();
    f.bridge.capability = () => ({ ok: false, reason: "no remote" });
    expect(await new PdfAdapter(f.bridge, f.io, "").isAvailable()).toEqual({
      ok: false,
      reason: "no remote",
    });
  });

  it("passes header and footer templates to the bridge only when labels are given", async () => {
    const render = vi.fn<PdfBridge["render"]>(() => Promise.resolve(PDF));
    const f = fakes({ render });
    const labels = {
      headerLeft: "Meetings/Sync",
      headerRight: "Last modified x",
      footerLeft: "Printed y",
    };
    await new PdfAdapter(f.bridge, f.io, "").run(doc, { ...opts, labels });
    expect(render.mock.calls[0]?.[1].headerFooter?.header).toContain("Meetings/Sync");
    expect(render.mock.calls[0]?.[1].headerFooter?.footer).toContain('class="totalPages"');
    await new PdfAdapter(f.bridge, f.io, "").run(doc, opts);
    expect(render.mock.calls[1]?.[1].headerFooter).toBeUndefined();
  });

  it("isPdf", () => {
    expect(isPdf(PDF)).toBe(true);
    expect(isPdf(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});
