import type { CoreWarning } from "./types";

/**
 * Output filename templates (SPEC 3.6). Pure.
 *
 * Variables: {title}, {date}, {datetime}, {preset}, {frontmatter.<key>}.
 * {date} is the note's `date` property when it is a valid date, otherwise today (local time),
 * formatted YYYY-MM-DD. {datetime} is now, formatted "YYYY-MM-DD HHmm" (no colons on macOS).
 */

export const MAX_FILENAME_LENGTH = 120;
export const FALLBACK_FILENAME = "Untitled";

export interface FilenameContext {
  /** Note title (basename without extension). */
  title: string;
  /** Active preset name. */
  preset?: string;
  properties: Readonly<Record<string, unknown>>;
  now: Date;
}

export interface FilenameResult {
  /** Sanitized name without extension. */
  name: string;
  warnings: CoreWarning[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Accepts a Date or a string starting with YYYY-MM-DD (as Obsidian date properties are). */
function noteDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // YAML dates without a time parse as UTC midnight; use the UTC calendar date.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (m) {
      const [, y, mo, d] = m;
      const date = new Date(Number(y), Number(mo) - 1, Number(d));
      if (date.getMonth() === Number(mo) - 1 && date.getDate() === Number(d))
        return `${y}-${mo}-${d}`;
    }
  }
  return null;
}

function propertyText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return noteDate(value);
  if (Array.isArray(value)) {
    const parts = value.map(propertyText).filter((v): v is string => v !== null && v !== "");
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function findProperty(props: Readonly<Record<string, unknown>>, key: string): unknown {
  if (key in props) return props[key];
  const match = Object.keys(props).find((k) => k.toLowerCase() === key.toLowerCase());
  return match === undefined ? undefined : props[match];
}

export function renderFilename(template: string, ctx: FilenameContext): FilenameResult {
  const warnings: CoreWarning[] = [];
  const warn = (message: string): void => {
    warnings.push({ code: "filename-variable", message });
  };

  const rendered = template.replace(/\{([^{}]*)\}/g, (whole, rawName: string) => {
    const name = rawName.trim();
    if (name === "title") return ctx.title;
    if (name === "date")
      return noteDate(findProperty(ctx.properties, "date")) ?? formatDate(ctx.now);
    if (name === "datetime") {
      return `${formatDate(ctx.now)} ${pad(ctx.now.getHours())}${pad(ctx.now.getMinutes())}`;
    }
    if (name === "preset") {
      if (ctx.preset) return ctx.preset;
      warn("{preset} is empty: no preset is active");
      return "";
    }
    if (name.startsWith("frontmatter.")) {
      const key = name.slice("frontmatter.".length);
      const text = propertyText(findProperty(ctx.properties, key));
      if (text === null || text === "") {
        warn(`{${name}} is empty: the note has no "${key}" property`);
        return "";
      }
      return text;
    }
    warn(`unknown variable ${whole} removed`);
    return "";
  });

  const name = sanitizeFilename(rendered);
  if (name === FALLBACK_FILENAME && sanitizeFilename(rendered, MAX_FILENAME_LENGTH, "") === "") {
    warn(`template produced an empty name; using "${FALLBACK_FILENAME}"`);
  }
  return { name, warnings };
}

/**
 * Make a string safe as a macOS filename inside a vault: strip path separators, colons and
 * characters Obsidian rejects in file names, control characters and leading dots; collapse
 * whitespace; trim stray separators; cap the length without splitting a character.
 */
export function sanitizeFilename(
  name: string,
  maxLength = MAX_FILENAME_LENGTH,
  fallback = FALLBACK_FILENAME,
): string {
  let s = name
    // eslint-disable-next-line no-control-regex -- control characters are exactly what we strip
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s-]+/, "")
    .replace(/[\s-]+$/, "");
  const chars = Array.from(s);
  if (chars.length > maxLength) s = chars.slice(0, maxLength).join("").trimEnd();
  s = s.replace(/[.\s]+$/, "");
  return s === "" ? fallback : s;
}

/**
 * Pick a name that does not exist yet: "name.ext", then "name (2).ext", "name (3).ext", ...
 * Never overwrites (SPEC 3.6); the caller asks before replacing an existing file.
 */
export function uniqueFilename(
  base: string,
  ext: string,
  exists: (candidate: string) => boolean,
): string {
  const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
  let candidate = `${base}${dotExt}`;
  for (let n = 2; exists(candidate); n++) candidate = `${base} (${n})${dotExt}`;
  return candidate;
}
