# Selective Print for Obsidian: Scope and Build Instructions

> This file is `SPEC.md`. The working agreement lives in `CLAUDE.md`.
> Audience: Claude Code, building a new Obsidian desktop plugin from scratch.
> Owner: Brian. Platform: **macOS only** (Obsidian desktop). Distribution: BRAT first (GitHub releases), community directory is not a goal.

---

## 1. Executive summary

Build an Obsidian plugin that **prints and exports notes to PDF (and other formats), with the user choosing which sections are included at the moment of invocation**.

Core idea: every print/export invocation opens a **review dialog** showing the note's section tree as a checklist. Defaults come from a **global exclude list in settings** (prepopulated with `Transcript`, the Krisp transcript import) plus optional **presets**, so a note's Transcript section is deselected by default. The user can review and adjust before output. This is generic: it works for any note type, and presets define defaults per note type.

Obsidian has Export to PDF but no Print command and no section-level selection. This plugin fills that gap.

### Differentiators (build to these, not to generic layout features)

1. **Section selection at invocation**, with exclude-list defaults from settings and presets (the headline feature). through v1.0 the plugin is **exclude-only**: there are no include lists.
2. **Presets as Markdown files in the vault**, matched to notes by property, tag, folder or filename.
3. **Multiple output formats from one pipeline**: native Print, PDF, self-contained HTML, filtered Markdown.
4. **Safe-to-share mode** that fails closed (v1.1).
5. **Strong validation and documentation** built in: preset validation, drift warnings, test fixtures, manual QA checklist.

### Non-goals

- Letterheads, logos, custom typography engines, themes marketplace. (Another plugin already owns that space; do not compete.)
- Windows, Linux, mobile. Do not add code paths for them. Detect and show a clear "macOS desktop only" notice.
- Any network access, telemetry, accounts or remote services. None, ever.
- Reading, importing or depending on any other plugin's code or settings. The plugin sees only note files in the vault.

---

## 2. Terminology

| Term | Meaning |
|---|---|
| **Section** | A heading plus everything under it until the next heading of the same or higher level. Content before the first heading is the **Preamble** pseudo-section. |
| **Section tree** | Nested sections, parsed from the note source. |
| **Preset** | A named set of defaults (sections, properties, callouts, output options) with an optional **matcher** that binds it to a type of note. |
| **Global exclude list** | Heading names excluded by default from every print/export, set in plugin settings. Prepopulated with `Transcript`. |
| **Matcher** | Rules (property, tag, folder, filename) deciding which presets apply to a note. |
| **Selection** | The final include/exclude state of every section for one invocation. |
| **Adapter** | A pluggable output step: Print, PDF, HTML, Markdown. |
| **Invocation** | One user action: "print/export this note now". |

---

## 3. Functional requirements

### 3.1 The review dialog (headline feature, must-have for v0.1)

Opened by every Print/Export invocation unless the user has explicitly chosen a no-dialog path (see 3.7).

Contents:

- **Preset dropdown.** Lists matching presets first (most specific match first, selected by default), then all other presets, then the built-in "Default" and "Everything" presets.
- **Output format dropdown.** Print, PDF, HTML, Markdown (only those whose adapter is available).
- **Section checklist**, shown as a tree:
  - One checkbox per section, indented by heading level.
  - Toggling a parent toggles all its children; parent shows an indeterminate state when children differ.
  - Preamble appears as the first row when non-empty.
  - Sections excluded by default (global list, preset or note) are shown **unchecked** with a small tag naming the source ("global", "preset" or "note"). Checking one includes it for this invocation. Nothing is ever hidden from the list.
  - Each row shows the heading text and a short size hint (line count or word count) so long sections such as transcripts are obvious.
  - Sections that are **empty** (see 3.4) are shown dimmed with an "empty" tag.
- **Quick actions:** Select all, Select none, Reset to preset defaults, Invert.
- **Document options:** Include note title (on/off); Include properties (None / All / Choose…); Skip empty sections (on/off).
- **Warnings area:** preset references a heading that does not exist in this note ("not found: Decisions"); preset validation errors; adapter unavailable.
- **Primary button** labelled by output ("Print", "Save PDF", "Export HTML", "Export Markdown") and Cancel.
- **Persistence controls (secondary menu on the button or a footer link):**
  - "Remember these choices for this note" writes the full list of unchecked sections to `print-exclude` in the note's frontmatter via `processFrontMatter`. That list replaces preset and global exclusions for the note (see 3.3).
  - "Save as new preset…" writes a preset file (see 3.3).
  - Default: selections are **not** persisted. They apply to this invocation only.

**Acceptance criteria**

- Opening the dialog, with default settings, on any note that has a `Transcript` heading shows that section **unchecked** and every other section checked.
- Checking Transcript and clicking Print includes it in output. Cancelling changes nothing on disk.
- Keyboard accessible: Tab order, Space toggles, Enter confirms, Esc cancels.
- The dialog renders correctly in light and dark themes.

### 3.2 Section model

- Parse **the note source** (not the rendered DOM). Reason: DOM filtering is fragile with embeds and async blocks.
- The parser is a **pure function** with no Obsidian imports: `parseSections(markdown: string): SectionTree`. It must be fence-aware (lines starting with `#` inside fenced code blocks are not headings), handle YAML frontmatter, setext headings, and trailing `#` characters.
- Each section has: stable `id` (path-based, e.g. `2:Decisions#1` for the first H2 named Decisions), `level`, `title`, `startLine`, `endLine`, `children`, `isEmpty`, `wordCount`.
- Duplicate heading names are legal. Rules match by text and apply to all occurrences; dialog selections operate on `id`.
- Excluding a heading excludes its descendants by default. In the dialog the user may re-check individual descendants afterwards; selection is always stored per section `id`.

### 3.3 Presets

Presets are **Markdown files in a vault folder** (default `Print Presets/`, configurable). They sync with the vault and are editable in Obsidian. The body of the file is free text for the user's own notes and is ignored by the engine.

Preset file frontmatter (v1 schema):

```yaml
---
selective-print-preset: true      # marker; required
preset-version: 1                 # schema version; required
name: Meeting notes               # unique display name; required
description: Meeting notes minus empty sections; transcript excluded via the global list
applies-to:                       # optional matchers; any-of between entries, all-of within an entry
  - property: type
    equals: meeting
  # - tag: customer-call
  # - folder: "Projects/Active"
  # - filename-matches: "* - weekly review"   # glob, case-insensitive
sections:
  inherit-global: true            # true: union with the global exclude list; false: this preset's list replaces it
  exclude: []                     # heading text, case-insensitive, trimmed; "regex:^Appendix" also allowed
  skip-empty: true                # drop sections with no real content
include-title: true
properties:
  mode: all                       # none | all | except
  list: []                        # property names, used by except
callouts:
  exclude-types: []               # e.g. [private, internal]
inline-markers: true              # honor %% print:exclude %% ... %% /print:exclude %%
output:
  format: print                   # print | pdf | html | markdown
  pdf-folder: ""                  # vault-relative folder; empty = next to the note
  filename: "{date} - {title}"    # template; see 3.6
  paper: letter                   # letter | a4
  orientation: portrait
  footer: ""                      # optional footer text (v1.1)
---
Free-text notes about this preset go here.
```

Rules:

- **Exclusion resolution** (highest first): (1) dialog selection; (2) note frontmatter `print-exclude`, which, when present, **replaces** preset and global exclusions entirely (an empty list means include everything); (3) the preset's `sections.exclude`, unioned with the global exclude list unless the preset sets `inherit-global: false`; (4) the global exclude list from settings; (5) include everything. There are **no include lists** through v1.0. To print a normally excluded section, check it in the dialog, or use a preset with `inherit-global: false`.
- **Matching:** collect all presets whose `applies-to` matches. Order by specificity: property match > tag > folder > filename. Never auto-pick silently when more than one matches; the dialog's dropdown shows all, with the most specific selected. A note with `print-preset: <name>` frontmatter always wins.
- **No match:** fall back to the built-in "Default" preset (global exclude list applies) and the checklist still works.
- **Validation:** every preset file is validated on load and on change. Invalid presets are listed in settings with the reason and are skipped, never crash the plugin. Provide a command **"Validate print presets"** that reports all problems.
- **Starters:** bundled presets are copied into the presets folder on first run (see section 6). Never overwrite a preset the user modified.

Note-level frontmatter keys (all optional):

| Key | Meaning |
|---|---|
| `print-preset` | Force a preset by name |
| `print-exclude` | Complete list of heading texts to exclude for this note; replaces preset and global exclusions (empty list = include everything) |

### 3.3a Global exclude list (settings)

The setting that delivers the default behavior: **print everything except the Transcript section, with the option to include it at invocation.**

- A list of heading names in plugin settings, **prepopulated with `Transcript`** on first install. Editable (add, remove, edit), with a **Reset to default** button that restores `Transcript`.
- Matching: heading text, case-insensitive, trimmed, **any heading level**. `Transcript` matches `## Transcript` but not `## Transcript (Krisp)`. An entry written as `regex:<pattern>` is treated as a regular expression (validated on save; invalid patterns are rejected with a message).
- Applies to **every note** that has a heading by that name, regardless of note type or preset matcher. Subheadings under an excluded section go with it.
- A note that lacks a listed heading is unaffected. The global list **never** produces "not found" warnings (it will naturally name headings many notes lack). Drift warnings apply to presets only.
- The dialog lists globally excluded sections unchecked, tagged "global". Because "Always review before output" is on by default, a transcript is never included by accident, and never hidden from the choice.
- The quick/no-dialog paths use the same defaults, so Transcript stays excluded there too.
- **Exclude-only through v1.0.** Include lists and an "include only these sections" mode are deferred (see Backlog). If added later, guard against output that would be empty.

### 3.4 Content filtering rules

Applied to the note source in this order:

1. Split frontmatter from body.
2. Apply section selection (dialog result).
3. Remove `%% print:exclude %% ... %% /print:exclude %%` blocks (fence-aware; unmatched start marker is a validation warning and excludes to end of its section).
4. Remove callouts whose type is in `callouts.exclude-types` (including nested content of that callout).
5. If `skip-empty` is on, drop sections that are empty after the steps above. **Empty means**: only whitespace, empty list markers (`-`, `*`, `1.`), empty task checkboxes (`- [ ]` with no text), and HTML comments. This matters because generated meeting notes leave placeholder bullets and checkboxes in unfilled sections.
6. Apply property filtering to the frontmatter rendering.

Everything here is a pure function over strings so it is unit-testable without Obsidian.

### 3.5 Rendering

- Render the filtered Markdown with `MarkdownRenderer.render` into a detached container, with the note's path as source path so links and embeds resolve.
- **Wait for async content** (Dataview, Bases, Mermaid, MathJax, images) before output: use a settle detector (MutationObserver quiet period with a hard timeout) and surface a warning if the timeout is reached.
- Embeds (`![[...]]`) render as Obsidian renders them through v1.0. Heading-level filtering inside embedded notes is out of scope until v1.3 (document this limitation).
- Convert images to data URIs for HTML output so exported HTML is self-contained.
- **Print stylesheet** (one shared file used by Print, PDF and HTML adapters):
  - Forces a light color scheme regardless of the active Obsidian theme (setting: "Match theme" vs "Neutral", default Neutral).
  - `break-inside: avoid` for callouts, tables, code blocks, images; `break-after: avoid` for headings.
  - Sensible defaults: Letter, portrait, 0.75in margins; user-overridable via a user CSS snippet scoped with a `.selective-print` body class.

### 3.6 Output adapters (multiple formats)

All adapters implement one interface so new formats can be added without touching the pipeline:

```ts
interface OutputAdapter {
  id: 'print' | 'pdf' | 'html' | 'markdown';
  label: string;
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  run(doc: RenderedDocument, opts: OutputOptions): Promise<OutputResult>;
}
```

| Adapter | Behavior | Notes |
|---|---|---|
| **Print** (v0.1) | Hidden iframe in the Obsidian window; populate it with the rendered document and stylesheet; call `iframe.contentWindow.print()`; clean up on `afterprint` plus a long fallback timer. Temporarily set `document.title` to the document title so the macOS PDF dropdown ("Save as PDF") proposes a good filename; restore afterwards. | No Electron APIs. This is the most durable path and the baseline. Must not inject or execute scripts in the iframe. |
| **PDF** (v0.3) | One-click Save PDF: render in a hidden Electron `BrowserWindow` via a bridge module, call `webContents.printToPDF`, verify the result starts with `%PDF-`, write to the configured vault folder using the filename template, then optionally open it in Preview. | Depends on Electron `remote`, which is deprecated upstream. Isolate in `electron-bridge.ts` with capability detection. If unavailable, **fall back** to the Print adapter with a notice ("use Save as PDF in the print dialog"). Never fail silently. |
| **HTML** (v1.1) | Write a self-contained `.html` file (inline CSS, images as data URIs, no scripts). | Also serves as the last-resort print path (open in browser). |
| **Markdown** (v1.1) | Write the *filtered* source as a new `.md` file or copy it to the clipboard. | Lets the user share a trimmed note. Frontmatter handling follows the property filter. |

Filename templates: `{title}`, `{date}` (note `date` property or today, `YYYY-MM-DD`), `{datetime}`, `{preset}`, `{frontmatter.<key>}`. Sanitize for macOS (strip `/` and `:`, trim, collapse spaces, cap length). Never overwrite an existing file without confirmation; default to appending ` (2)`.

Optional future adapter (document only, do not build): DOCX via Pandoc. It requires an external binary and is out of scope.

### 3.7 Triggers

| Trigger | Behavior |
|---|---|
| **Header icon** on every Markdown note (`MarkdownView.addAction`) | Click opens the review dialog. Shift-click, or the setting "Skip dialog", runs the preset's defaults directly. |
| **Commands** | "Print / export current note…" (dialog), "Quick print current note (preset defaults)", "Save current note as PDF", "Validate print presets", "Open presets folder", "Install / refresh starter presets". All usable with hotkeys. |
| **File-explorer / editor context menu** | "Print / export…" on a file. |
| **Ribbon icon** | Optional, off by default. |
| **URI** (v1.1) | `obsidian://selective-print?file=<path>&preset=<name>&output=<format>&dialog=<true|false>`. Registered with `registerObsidianProtocolHandler`. Validate and encode all parameters; resolve `file` only inside the vault. |

Header actions are attached per leaf: re-add on `layout-change` and `file-open`, guard against duplicates, and remove on unload.

**Setting: "Always review before output"** defaults to **on**. This is the user's stated requirement: defaults apply, but the user can review and adjust on every invocation.

### 3.8 Safe-to-share mode (v1.1, fail closed)

- A toggle in the dialog and a preset option. When on: apply property redaction (`properties.mode: except` plus a configurable list such as attendee emails), exclude listed callout types, and show an "Excluded: …" summary at the end of the dialog.
- **Fail closed:** if any redaction rule cannot be applied (invalid regex, unmatched marker, adapter error mid-run), abort and tell the user. Never output the unredacted note as a fallback.
- Optional footer text such as "Confidential".

### 3.9 Later phases (design for, do not build before v1.0)

- v1.2: sidebar panel (persistent section checklist beside the note with live preview).
- v1.3: multi-note packs (all notes matching a property/folder/week into one document with cover and TOC); embedded-note heading filtering.

---

## 4. Starter presets (bundled, copied on first run)

The plugin must work for any note. These starters are *examples that match the note structure generated by Brian's Meeting Notes for Apple Calendar plugin*. They are plain data. **The plugin must never read, detect or integrate with that plugin.**

Heading names below come from that plugin's README; mark each starter's file with `<!-- verified against README, not against live notes -->` until Brian confirms.

| Starter | Matcher | Defaults |
|---|---|---|
| **Default** (built-in) | none | Global exclude list applies (Transcript excluded out of the box) |
| **Meeting notes** | `type = meeting` | Inherits the global list (Transcript excluded); skip-empty on; all properties |
| **Meeting recap** | `type = meeting` | Inherits the global list and also excludes `Agenda` and `Notes`, leaving Meeting Summary, Decisions and Action items; skip-empty on |
| **Meeting full (with transcript)** | `type = meeting` | `inherit-global: false`, no exclusions, so the transcript is included |
| **Meeting tracker** | filename matches `Meeting Tracker*` | Inherits the global list, no additional exclusions; its headings are not verified, so ship it with a TODO comment and no assumptions beyond a generic structure |
| **Weekly review** | folder `Weekly Reviews` | Same caveat as the tracker: ship minimal, mark unverified |
| **Everything** (built-in) | none | No exclusions at all; transcript included |

Rule for all starters: **drift detection**. If a preset names a heading the note does not have, the dialog shows "not found: <heading>" and continues. This is how template changes in other tools are noticed, without any coupling.

Starter versioning: each bundled preset carries `starter-version: N`. On plugin upgrade, add new starters; for an existing starter file, update only if the file's content hash matches the previously shipped version (unmodified). If modified, leave it and offer "Compare with new starter" (writes the new version next to it as `<name> (new starter).md`).

---

## 5. Architecture and code layout

Language: TypeScript (strict), esbuild bundle, Obsidian plugin API. Verify all API signatures against the installed `obsidian` typings rather than from memory.

```
/
├─ SPEC.md                    # this file
├─ CLAUDE.md                  # working agreement + conventions (copy from section 9)
├─ README.md                  # user-facing: install via BRAT, quick start, screenshots
├─ CHANGELOG.md
├─ RELEASE_PROCESS.md
├─ LICENSE                    # MIT
├─ manifest.json  versions.json  version-bump.mjs  esbuild.config.mjs
├─ package.json  tsconfig.json  eslint config  vitest config
├─ styles.css                 # plugin UI styles (dialog)
├─ print.css                  # shared print stylesheet (bundled as a string)
├─ docs/
│  ├─ USER_GUIDE.md
│  ├─ PRESETS.md              # full schema reference with examples
│  ├─ ARCHITECTURE.md
│  ├─ TESTING.md
│  ├─ MANUAL_QA.md            # macOS checklist (section 7.3)
│  ├─ VALIDATION.md           # what is verified, how, and what is NOT verified
│  └─ TROUBLESHOOTING.md
├─ src/
│  ├─ main.ts                 # plugin entry, wiring only
│  ├─ core/                   # PURE, no Obsidian imports, fully unit tested
│  │  ├─ sections.ts          # parseSections
│  │  ├─ selection.ts         # resolve exclusions: dialog > note > preset+global > global
│  │  ├─ filter.ts            # markers, callouts, skip-empty, property filter
│  │  ├─ presets.ts           # schema, validation, matching, specificity
│  │  ├─ filename.ts          # templates and sanitizing
│  │  └─ types.ts
│  ├─ obsidian/               # thin adapters over Obsidian APIs
│  │  ├─ vault-presets.ts     # load/watch/install/validate preset files
│  │  ├─ note-source.ts       # read note, frontmatter, processFrontMatter writes
│  │  ├─ render.ts            # MarkdownRenderer + settle detector
│  │  └─ triggers.ts          # header action, commands, menus, URI
│  ├─ ui/
│  │  ├─ ReviewModal.ts       # section tree, options, warnings
│  │  └─ SettingsTab.ts
│  └─ output/
│     ├─ adapter.ts           # interface + registry
│     ├─ print.ts  pdf.ts  html.ts  markdown.ts
│     └─ electron-bridge.ts   # capability detection, isolated
├─ starters/                  # bundled preset markdown files + hashes
└─ test/
   ├─ fixtures/               # sample notes, edge cases (see 7.1)
   └─ *.test.ts
```

Design rules:

- **Pure core.** Everything in `core/` takes strings and returns strings or plain objects. No `app`, no DOM. This is what makes the filtering trustworthy and testable.
- **Obsidian layer stays thin.** No business logic in `main.ts`, `triggers.ts` or the modal beyond wiring.
- **Settings** stored in `data.json` with a `schemaVersion` and a migration function from day one.
- **Lifecycle hygiene:** use `registerEvent`, `registerDomEvent`, `addCommand`; remove injected DOM and iframes on unload; no global listeners left behind; clean up temp files.
- **Security:** no network calls; no `eval` or dynamic code; build DOM with `createEl`/DOM APIs, not `innerHTML` with untrusted strings; strip `<script>` from rendered content before output; escape all values interpolated into HTML; resolve file paths with `normalizePath` and confine them to the vault; URI parameters are untrusted input.
- **Failure behavior:** every adapter failure produces a visible `Notice` with the reason and, where possible, a fallback. No silent failures, no unhandled promise rejections.

---

## 6. Settings (settings tab)

| Setting | Default |
|---|---|
| Always review before output | On |
| Default output format | Print |
| Global exclude list | `Transcript` (prepopulated, editable, Reset button) |
| Presets folder | `Print Presets` |
| Install/refresh starter presets | Button |
| Paper size / orientation | Letter / portrait |
| Margins | 0.75 in |
| Print style | Neutral (vs Match theme) |
| PDF folder / filename template | Next to note / `{date} - {title}` |
| Open PDF in Preview after save | Off |
| Show header icon | On |
| Show ribbon icon | Off |
| Skip empty sections (global default) | On |
| Debug logging | Off (verbose console logs prefixed `[SelectivePrint]`) |
| Validate presets | Button, shows report |

---

## 7. Validation and quality (build all of this in, not at the end)

### 7.1 Automated tests (Vitest; run in CI and pre-release)

Unit tests for every `core/` module. Required fixtures in `test/fixtures/`:

- Plain note with H1/H2/H3 nesting.
- Note with frontmatter and Properties-style YAML (lists, quoted strings, dates).
- Duplicate heading names.
- Global exclude list: `Transcript` present, absent, with nested subheadings, duplicated, case variants, and a `regex:` entry; precedence cases against note `print-exclude` and a preset with `inherit-global: false`.
- Headings inside fenced code blocks (must not parse as sections).
- Setext headings; trailing `#` characters; headings with links, emphasis, emoji.
- Content before the first heading (Preamble).
- Empty sections containing only `-`, `- [ ]`, blank lines, HTML comments.
- Callouts including nested and foldable callouts; excluded callout types.
- `%% print:exclude %%` blocks: balanced, nested, unmatched, inside code fences.
- Large transcript (10k+ lines) for performance.
- A generated-style meeting note matching the starter's expected headings, plus variants with missing and renamed headings (drift).
- Preset files: valid, missing required keys, wrong types, unknown keys, bad regex, duplicate names.
- Filename templates: illegal characters, long names, missing variables.

Coverage target: ≥90% lines for `core/`. Property-style tests (fuzz) for the section parser: round-trip invariant "concatenating all section slices reproduces the body".

### 7.2 Static checks

TypeScript `strict`, no `any` without a comment, ESLint including the Obsidian plugin ruleset (`eslint-plugin-obsidianmd` or its current equivalent), Prettier. CI (GitHub Actions) runs lint, typecheck, tests and the production build on every push and PR; the release workflow builds `main.js`, `manifest.json`, `styles.css` and attaches them to the GitHub release.

### 7.3 Manual QA on macOS (`docs/MANUAL_QA.md`, must be completed per release)

Claude Code cannot run Obsidian on the user's Mac. Produce this checklist and **never claim these are verified unless Brian reports results**:

1. Print dialog opens from the header icon, and from the command palette.
2. The macOS print panel's PDF dropdown ("Save as PDF") works and proposes the note title as filename.
3. Dialog defaults: on any note with a `Transcript` heading (default settings), Transcript is unchecked; checking it includes it. Editing the global exclude list in settings changes the next dialog's defaults.
4. Output matches selection exactly for: no sections excluded, one excluded, parent with children excluded, everything but one section.
5. Callouts, tables, task checkboxes, code blocks, images, wikilinks render legibly; dark theme prints with light styling.
6. Page breaks: headings not orphaned; tables and callouts not split awkwardly.
7. Async blocks (Dataview or Bases if installed) appear in output, or a visible warning is shown.
8. Cancel leaves no files, temp elements or console errors.
9. PDF adapter: file written to the right folder with the right name; `%PDF-` header; opens in Preview.
10. PDF adapter fallback: simulate `remote` unavailable; confirm notice and fallback to Print.
11. Reload and disable/enable the plugin: no duplicate header icons, no leaked iframes.
12. Record Obsidian version, macOS version, plugin version and result for each item in `docs/VALIDATION.md`.

### 7.4 In-product validation

- Preset validation with human-readable errors (file, field, expected value).
- Drift warnings in the dialog ("not found: Decisions").
- Preview summary: "N sections included, M excluded, K empty skipped".
- Debug logging toggle; "Copy diagnostics" button in settings (plugin version, Obsidian version, platform, enabled adapters, preset load results; contains no note content).

---

## 8. Documentation requirements

Ship with the code, update with each milestone:

- **README.md:** what it is, install via BRAT, 60-second quick start, GIF/screenshots placeholders, supported formats, macOS-only note, link to guides.
- **docs/USER_GUIDE.md:** the dialog, presets, per-note overrides, adapters, troubleshooting basics.
- **docs/PRESETS.md:** complete schema reference, resolution precedence, matching and specificity rules, worked examples (meeting, weekly review, project note, generic), how to create a preset from the dialog.
- **docs/ARCHITECTURE.md:** pipeline diagram, module responsibilities, the pure-core rule, adapter interface, how to add an adapter.
- **docs/TESTING.md:** how to run tests, how fixtures work, how to add a fixture.
- **docs/VALIDATION.md:** the honest status table: for each capability, "automated", "manual-verified on <versions>", or "unverified".
- **docs/TROUBLESHOOTING.md:** print dialog does not open, PDF fallback message, missing sections, blank output, async blocks.
- **CHANGELOG.md** (Keep a Changelog) and **RELEASE_PROCESS.md** modeled on a simple manual process: bump version (`version-bump.mjs`), update `versions.json`, run tests and build, tag, GitHub release with the three assets.

---

## 9. Working agreement

The authoritative working agreement, stop gates and pass protocol live in **`CLAUDE.md`** (Claude Code reads it automatically). This spec defines *what* to build; `CLAUDE.md` defines *how and when to proceed and when to stop and ask*. If the two ever conflict, stop and ask Brian.

---

## 10. Roadmap, milestones and acceptance criteria

### Versions

| Version | Milestones | Pass | What Brian gets |
|---|---|---|---|
| (internal) | M0, M1 | 1 | Scaffold, feasibility spikes, tested pure core. Nothing released. |
| **0.1.0** | M2 | 2 | Review dialog, Print adapter, global exclude list (Transcript prepopulated), header icon, commands. First BRAT build. |
| **0.2.0** | M3 | 3 | Presets as vault files, matching, note-level overrides, starters. |
| **0.3.0** | M4 | 4 | One-click PDF adapter with fallback to the print dialog. |
| **1.0.0** | M5 | 5 | Hardening, complete docs, full macOS QA signed off by Brian. |
| 1.1 | M6 | later | HTML and Markdown adapters, safe-to-share mode, URI handler, footer text. |
| 1.2 | M7 | later | Sidebar panel. |
| 1.3 | M8 | later | Multi-note packs, heading filtering inside embeds. |

**What "version 1.0" means:** feature-complete for daily use on Brian's Mac. Filtered Print and one-click PDF both work; the review dialog and global exclude list behave as specified; presets and starters work; documentation, tests and the manual QA checklist are complete, with QA results reported by Brian. Anything else is post-1.0 and needs a scope confirmation first (see `CLAUDE.md`).

### M0: Scaffold and feasibility spikes

- Scaffold from the standard Obsidian sample plugin structure with the layout in section 5, strict TS, esbuild, ESLint, Vitest, GitHub Actions CI, release workflow, `manifest.json` (`isDesktopOnly: true`; choose `minAppVersion` from the oldest Obsidian version whose APIs you actually use and record it), `LICENSE`, `STATUS.md`, `docs/BACKLOG.md` and docs stubs.
- Plugin ID and name: **Selective Print**, id `selective-print`. Keep identifiers in one constants file.
- **Spike A (print):** a command that renders a hardcoded note into a hidden iframe and calls `print()`. Document exactly what to click to test on macOS and what to look for.
- **Spike B (PDF):** detect `window.require('electron')` and whether `remote.BrowserWindow` and `webContents.printToPDF` exist; report capabilities in a "Show diagnostics" command. Do not build the full adapter yet.
- Output: `docs/SPIKE_RESULTS.md` with commands, observations, and a clear "Brian to test" checklist.
- **Acceptance:** CI green; plugin loads in an Obsidian dev vault; diagnostics command reports capability state; spike checklist written.

### M1: Core engine (pure)

- Implement `sections`, `selection`, `filter`, `presets`, `filename` with full fixtures and tests from 7.1.
- **Acceptance:** all core tests pass at ≥90% coverage; round-trip invariant holds; exclusion resolution (dialog > note `print-exclude` > preset+global > global > none) covered by tests; skip-empty behaves correctly on the generated-style meeting fixture.

### M2: Review dialog, global exclude list, Print adapter (release 0.1.0)

- ReviewModal with section tree, tri-state parents, size hints, source tags, quick actions, options, warnings.
- Header icon, commands, context menu; "Always review before output" setting.
- Print adapter (iframe), shared print stylesheet, render pipeline with settle detector.
- Built-in "Default" (global exclude list) and "Everything" presets.
- Settings tab with the **global exclude list** (add, remove, edit, Reset to default), prepopulated with `Transcript`.
- **Acceptance:** on a meeting-style fixture, Transcript is unchecked by default; toggling works; selection exactly controls rendered output (tested by snapshot of the filtered source passed to the renderer); cancel leaves no residue; MANUAL_QA items 1-8 prepared.

### M3: Presets as vault files, matching, starters (release 0.2.0)

- Preset loader/watcher, validation report command, matching with specificity, `print-preset` / `print-exclude` note keys, "Save as new preset", "Remember for this note".
- Install/refresh starters with the versioning rules in section 4.
- **Acceptance:** editing a preset file updates the dialog defaults without restart; invalid presets are reported, not fatal; multiple matches listed with most specific selected; starters install without overwriting modified files; drift warnings appear for missing headings in presets.

### M4: PDF adapter (release 0.3.0)

- PDF adapter with the Electron bridge, capability detection, fallback to Print, filename templates, optional open-in-Preview.
- Output format dropdown in the dialog driven by `isAvailable()`.
- **Acceptance:** adapter registry tested with fakes; PDF failure paths tested via injected bridge fakes; filename sanitizing tested; MANUAL_QA items 9-10 prepared. If Spike B showed `remote` is unavailable, replace this milestone's scope with a Brian-approved alternative (see Gate A in `CLAUDE.md`).

### M5: Hardening, docs, release (release 1.0.0)

- "Copy diagnostics"; performance check on a 10k-line note; complete all docs in section 8; finalize `VALIDATION.md` with real status.
- Fresh-vault install via the BRAT instructions works; README quick start is accurate.
- **Acceptance:** every MANUAL_QA item is either reported passing by Brian or listed in the release notes as unverified; CHANGELOG and RELEASE_PROCESS complete.

### Post-1.0 (confirm scope with Brian before starting each)

- **M6 (1.1):** HTML adapter (self-contained), Markdown adapter, safe-to-share mode (fail closed), URI handler, footer text.
- **M7 (1.2):** Sidebar panel with live preview.
- **M8 (1.3):** Multi-note packs; heading filtering inside embedded notes.

### Backlog (do not build until scheduled)

Include lists and an include-only mode (global toggle, `print-include` note key, with an empty-output guard); PDF outline/bookmarks (verify bundled Electron version first); DOCX via Pandoc; per-preset headers/footers with page numbers beyond basic footer text.

---

## 11. Open decisions for Brian (defaults assumed if unanswered)

| Decision | Assumed default |
|---|---|
| Plugin name and id | Selective Print / `selective-print` |
| Include lists / include-only mode | Deferred; v0.1 is exclude-only |
| Minimum Obsidian version | Lowest version whose APIs are used, recorded in M0 |
| Presets location | Vault folder `Print Presets/` (not plugin settings) |
| Paper default | US Letter |
| Header icon visibility | All Markdown notes |
| Public repo and license | Public, MIT |
