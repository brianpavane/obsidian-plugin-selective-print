# Architecture

## Assumed versions

| Component              | Version                                                                                              | Source                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsidian (Brian's Mac) | 1.14.4                                                                                               | Brian, Gate 0 (2026-10-07)                                                                                                                                           |
| macOS                  | 26.7                                                                                                 | Brian, Gate 0 (2026-10-07)                                                                                                                                           |
| `obsidian` typings     | 1.13.1                                                                                               | Latest on npm at M0. Older than the app; APIs are checked against these typings.                                                                                     |
| Electron / Chromium    | unknown                                                                                              | To be recorded from Spike B diagnostics at Gate A                                                                                                                    |
| `minAppVersion`        | 1.5.7                                                                                                | Oldest version with every API used (`getFileByPath`, `getFolderByPath`), according to `eslint-plugin-obsidianmd` (`no-unsupported-api`). Only 1.14.4 is ever tested. |
| Toolchain              | TypeScript 6.0.3, esbuild 0.28, ESLint 9 + `eslint-plugin-obsidianmd` 0.4.2, Vitest 5, Node 24 in CI | TypeScript 7 is out of typescript-eslint's supported range; ESLint 10 is not supported by the Obsidian ruleset.                                                      |

## Pipeline

```
trigger (header icon, command, menu)
  │
  ▼
readNote ──► parseSections ──► matchPresets ──► resolveDefaults ──► review dialog ──► buildJob
(source,      (sections.ts)    (presets.ts;     (selection.ts:      (dialog-state.ts;   (job.ts →
 properties,                    vault presets,   dialog > note       Remember writes     filterNote:
 tags)                          print-preset)    print-exclude >     print-exclude)      selection →
                                                 preset + global >                       markers →
                                                 global > none)                          callouts →
                                                                                         skip-empty →
                                                                                         properties)
                                                                                              │
                                                                                              ▼
                                       renderJob (MarkdownRenderer off screen + settle detector)
                                                                                              │
                                                                                              ▼
                              runWithFallback(adapter, Print)
                                ├─ Print: hidden sandboxed iframe → macOS print panel
                                └─ PDF:   Save panel / Desktop / vault target → temp HTML in the plugin
                                          folder → hidden BrowserWindow (no JS) → printToPDF →
                                          %PDF- check → write (never overwrite) → optional open
```

## Module responsibilities

| Module                             | Layer    | Responsibility                                                                                                                                                                                                                 |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/sections.ts`             | pure     | Parse note source into a section tree (frontmatter, ATX and setext headings, fences, comments, emptiness, size hints).                                                                                                         |
| `src/core/selection.ts`            | pure     | Compile exclude rules; resolve default exclusions by precedence; apply dialog overrides; drift warnings.                                                                                                                       |
| `src/core/filter.ts`               | pure     | Content filters (SPEC 3.4) and the `filterNote` pipeline.                                                                                                                                                                      |
| `src/core/presets.ts`              | pure     | Preset schema v1 validation, set validation (duplicates), matching, specificity, dropdown order, built-ins, serialization for "Save as new preset".                                                                            |
| `src/core/filename.ts`             | pure     | Filename templates, macOS-safe sanitizing, non-overwriting unique names.                                                                                                                                                       |
| `src/core/dialog-state.ts`         | pure     | Review-dialog checklist logic: tri-state parents, toggles, quick actions, size hints.                                                                                                                                          |
| `src/core/job.ts`                  | pure     | Builds the exact Markdown, title and properties to render for one invocation.                                                                                                                                                  |
| `src/core/note-keys.ts`            | pure     | `print-exclude` / `print-preset` parsing; the "Remember" list and its lossiness warnings.                                                                                                                                      |
| `src/core/starters-plan.ts`        | pure     | Starter install and upgrade plan (create, update unmodified, compare copy, skip).                                                                                                                                              |
| `src/core/header-footer.ts`        | pure     | Header and footer labels, CSS page-margin boxes (Print) and printToPDF templates (PDF), with escaping.                                                                                                                         |
| `src/core/diagnostics.ts`          | pure     | Diagnostics report formatting (no note content).                                                                                                                                                                               |
| `src/core/note-job.ts`             | pure     | A note's default job (matched or chosen preset, `print-exclude`, global list). Shared by Quick print and packs.                                                                                                                |
| `src/core/pack.ts`                 | pure     | Pack note dates, sorting, date filter, tag/property queries, reordering, link targets, anchors.                                                                                                                                |
| `src/core/digest.ts`               | pure     | Digest packs: keep only named sections (with subsections), intersected with the normal selection so exclusions win.                                                                                                            |
| `src/settings.ts`                  | pure     | Settings schema (`schemaVersion` 1), defaults, migration from any stored data.                                                                                                                                                 |
| `src/starters.ts`, `starters/*.md` | data     | Bundled starter presets (text) with the hashes of every shipped version.                                                                                                                                                       |
| `src/output/adapter.ts`            | testable | Adapter interface, page CSS, `checkAdapters`, `runWithFallback` (notice + Print fallback).                                                                                                                                     |
| `src/output/print.ts`              | Obsidian | Print adapter: hidden sandboxed iframe, constructed stylesheets, `print()`, cleanup.                                                                                                                                           |
| `src/output/pdf.ts`                | testable | PDF adapter with an injected bridge and I/O: serialize, temp HTML, render, `%PDF-` check, non-overwriting write, optional open.                                                                                                |
| `src/output/electron-bridge.ts`    | Electron | The only module that touches Electron: capability detection, the diagnostics probe, `renderHtmlFileToPdf` (hidden `BrowserWindow`, JavaScript disabled, sandboxed, always destroyed), `openPathExternally` (`shell.openPath`). |
| `src/obsidian/note-source.ts`      | Obsidian | Reads a note (from an open editor when there is one), frontmatter and tags.                                                                                                                                                    |
| `src/obsidian/render.ts`           | Obsidian | `MarkdownRenderer.render` off screen, settle detector, script stripping.                                                                                                                                                       |
| `src/obsidian/print-flow.ts`       | Obsidian | One invocation: presets and note keys → defaults → dialog → render → adapter (with fallback).                                                                                                                                  |
| `src/obsidian/vault-presets.ts`    | Obsidian | Preset store: load, watch (debounced), validate, create from the dialog, starter sync.                                                                                                                                         |
| `src/obsidian/note-writes.ts`      | Obsidian | The only note write: `print-exclude` via `processFrontMatter`, on "Remember".                                                                                                                                                  |
| `src/obsidian/pdf-io.ts`           | Obsidian | HTML serialization (vault images inlined), temp file in the plugin folder, vault writes, case-insensitive exists.                                                                                                              |
| `src/obsidian/pack-flow.ts`        | Obsidian | Packs: collect notes (folder, selection, query), render each, assemble cover/contents/notes, rewrite links, output with fallback.                                                                                              |
| `src/obsidian/triggers.ts`         | Obsidian | Header icon per Markdown view, without duplicates.                                                                                                                                                                             |
| `src/obsidian/diagnostics.ts`      | Obsidian | "Show diagnostics" (environment and Electron capabilities; no note content).                                                                                                                                                   |
| `src/ui/*`                         | Obsidian | Review dialog, settings tab, validation report, name prompt, preset picker. Rendering only.                                                                                                                                    |
| `src/main.ts`                      | Obsidian | Wiring only: settings, platform gate, adapters, commands, menus, events, unload cleanup.                                                                                                                                       |

**Pure-core rule:** `src/core/` takes strings and plain objects and returns strings and plain
objects. ESLint enforces it: `obsidian`, `electron`, `window`, `document` and `navigator` are
forbidden there. The Obsidian layer parses YAML with `parseYaml` or the metadata cache and
passes plain objects in.

## Core API (M1)

### sections.ts

```ts
parseSections(markdown: string, options?: { frontmatter?: boolean }): SectionTree
splitFrontmatter(source: string): { frontmatter: string | null; body: string }
splitLines(text: string): string[]                 // keeps terminators; join("") === text
isEmptyContent(lines: readonly string[]): boolean
plainHeadingText(title: string): string
descendantsAndSelf(section: Section): Section[]
```

`Section`: `id` (`<level>:<plain title>#<n>`, Preamble `0:Preamble#1`), `level` (0 = Preamble),
`title`, `plainTitle`, `startLine`, `headingEndLine`, `ownEndLine`, `endLine`, `children`,
`isEmpty` (whole subtree), `wordCount`, `lineCount`. Lines are 0-based over the full source;
ranges are half-open.

### selection.ts

```ts
resolveDefaults({ tree, globalExclude, preset?: { exclude, inheritGlobal } | null,
                  noteExclude?: string[] | null }): { defaults: SectionDefault[]; warnings }
finalSelection(defaults, overrides?: Map<id, boolean>): Set<id>   // included ids
findMissingHeadings(tree, presetExclude): CoreWarning[]           // drift: "not found: X"
compileRules(entries): { rules; errors }    validateRuleEntry(entry): string | null
```

**Selection precedence (highest first):**

1. Dialog override for that section id.
2. Note `print-exclude`. When the key is present, it **replaces** both of the following;
   an empty list includes everything.
3. Preset `sections.exclude`, unioned with the global list unless `inherit-global: false`.
4. The global exclude list (settings; default `["Transcript"]`).
5. Include everything.

Rules match the trimmed heading text case-insensitively at any level, against the plain text
(links and emphasis removed) or the raw text. `regex:<pattern>` is a case-insensitive regular
expression. Rules never match the Preamble. An excluded section takes its descendants with it
(`viaAncestor: true`); the dialog can re-check a descendant by id. When the preset and the
global list both name a heading, its source tag is `preset`.

### filter.ts

```ts
filterNote(tree, { included, inlineMarkers, excludeCalloutTypes, skipEmpty,
                   properties?: { values, mode, list } }): { body, properties?, warnings, stats }
applySelection(tree, included): string
removeExcludeMarkers(body): { text, warnings }
removeCallouts(body, types): string
skipEmptySections(body): { text, skipped }
filterProperties(values, mode: "none" | "all" | "except", list?): Record<string, unknown>
```

### presets.ts

```ts
validatePreset(frontmatter: unknown, file: string): { preset?, errors, warnings }
validatePresetSet(files: { file, frontmatter }[]): { presets, errors, warnings }
matchPresets(presets, note: { path, properties, tags }): { matches, warning? }
orderForDropdown(presets, match): Preset[]      defaultPreset(match): Preset
DEFAULT_PRESET, EVERYTHING_PRESET, BUILTIN_PRESETS, globToRegExp(pattern)
```

Specificity: property (4) > tag (3) > folder (2) > filename (1). An entry's score is its
strongest condition, then its number of conditions; ties sort by name. `print-preset` always
wins.

### filename.ts

```ts
renderFilename(template, { title, preset?, properties, now }): { name, warnings }
sanitizeFilename(name, maxLength = 120, fallback = "Untitled"): string
uniqueFilename(base, ext, exists: (name) => boolean): string     // "x.pdf", "x (2).pdf", ...
```

## Adapter interface and how to add an adapter

```ts
interface OutputAdapter {
  id: "print" | "pdf" | "html" | "markdown";
  label: string; // menu label, e.g. "PDF"
  action: string; // primary button, e.g. "Save PDF"
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  run(doc: RenderedDocument, opts: OutputOptions): Promise<OutputResult>;
}
```

To add one (for example HTML in 1.1):

1. Create `src/output/<name>.ts`. Inject anything environment-specific so it can be tested with
   fakes, as `pdf.ts` does.
2. Register it in `main.ts` (`this.adapters`).
3. Give it tests in `test/output.test.ts`.

The dialog's Output menu, `checkAdapters` and `runWithFallback` pick it up without changes.
`OutputResult.cancelled` means the user cancelled: no fallback and no error.
