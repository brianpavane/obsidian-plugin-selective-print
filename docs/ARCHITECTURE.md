# Architecture

## Assumed versions

| Component              | Version                                                                                              | Source                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsidian (Brian's Mac) | 1.14.4                                                                                               | Brian, Gate 0 (2026-10-07)                                                                                                                                              |
| macOS                  | 26.7                                                                                                 | Brian, Gate 0 (2026-10-07)                                                                                                                                              |
| `obsidian` typings     | 1.13.1                                                                                               | Latest on npm at M0. Older than the app; APIs are checked against these typings.                                                                                        |
| Electron / Chromium    | unknown                                                                                              | To be recorded from Spike B diagnostics at Gate A                                                                                                                       |
| `minAppVersion`        | 1.1.0 (provisional)                                                                                  | Highest documented `@since` among the APIs used (`addAction`). `MarkdownRenderer.render` has no `@since` tag in the typings. Only 1.14.4 is ever tested. Revisit at M2. |
| Toolchain              | TypeScript 6.0.3, esbuild 0.28, ESLint 9 + `eslint-plugin-obsidianmd` 0.4.2, Vitest 5, Node 24 in CI | TypeScript 7 is out of typescript-eslint's supported range; ESLint 10 is not supported by the Obsidian ruleset.                                                         |

## Pipeline

```
note source ──► parseSections ──► resolveDefaults ──► (review dialog, M2) ──► finalSelection
                  (sections.ts)     (selection.ts)        user toggles          (selection.ts)
                                         ▲                                           │
           global list (settings) ───────┤                                           ▼
           preset (presets.ts) ──────────┤                                    filterNote (filter.ts)
           note print-exclude ───────────┘                         selection → markers → callouts
                                                                   → skip-empty → properties
                                                                                     │
                                                                                     ▼
                                            render (M2: MarkdownRenderer + settle detector)
                                                                                     │
                                                       output adapter: Print (M2) · PDF (M4) · HTML/MD (1.1)
```

## Module responsibilities

| Module                          | Layer    | Responsibility                                                                                                         |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/core/sections.ts`          | pure     | Parse note source into a section tree (frontmatter, ATX and setext headings, fences, comments, emptiness, size hints). |
| `src/core/selection.ts`         | pure     | Compile exclude rules; resolve default exclusions by precedence; apply dialog overrides; drift warnings.               |
| `src/core/filter.ts`            | pure     | Content filters (SPEC 3.4) and the `filterNote` pipeline.                                                              |
| `src/core/presets.ts`           | pure     | Preset schema v1 validation, set validation (duplicates), matching, specificity, dropdown order, built-ins.            |
| `src/core/filename.ts`          | pure     | Filename templates, macOS-safe sanitizing, non-overwriting unique names.                                               |
| `src/settings.ts`               | pure     | Settings schema (`schemaVersion` 1), defaults, migration from any stored data.                                         |
| `src/output/electron-bridge.ts` | Electron | The only module that touches Electron. Capability detection and the in-memory `printToPDF` probe.                      |
| `src/spikes/*`                  | Obsidian | M0 spikes. Replaced by the Print adapter (M2) and "Copy diagnostics" (M5).                                             |
| `src/main.ts`                   | Obsidian | Wiring only: settings load, platform gate, commands, unload cleanup.                                                   |

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

## Adapter interface (implemented from M2)

See `SPEC.md` section 3.6. Each output adapter implements `isAvailable()` and `run()`.
Adding an adapter means a new file in `src/output/` and a registry entry; the pipeline does
not change.
