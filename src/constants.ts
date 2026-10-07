/** All plugin-wide identifiers live here. Do not rename without asking (CLAUDE.md section 10). */
export const PLUGIN_ID = "selective-print";
export const PLUGIN_NAME = "Selective Print";
export const LOG_PREFIX = "[SelectivePrint]";

/** CSS class added to the print document body; user snippets scope overrides with it. */
export const PRINT_BODY_CLASS = "selective-print";
/** Added with PRINT_BODY_CLASS when the print style is "Neutral" (forced light colors). */
export const NEUTRAL_CLASS = "selective-print-neutral";
/** Off-screen container where notes are rendered before printing. */
export const RENDER_HOST_CLASS = "selective-print-render-host";
/** CSS class for the hidden print iframe in the Obsidian window. */
export const PRINT_FRAME_CLASS = "selective-print-frame";

export const DEFAULT_GLOBAL_EXCLUDE: readonly string[] = ["Transcript"];
export const DEFAULT_PRESETS_FOLDER = "Print Presets";

/** Fallback cleanup for the print iframe when `afterprint` never fires. */
export const PRINT_CLEANUP_TIMEOUT_MS = 5 * 60 * 1000;

/** Render settle detector: quiet period with no DOM changes, and a hard timeout. */
export const RENDER_QUIET_MS = 400;
export const RENDER_TIMEOUT_MS = 8000;
