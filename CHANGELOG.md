# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Tags equal the version with no `v` prefix.

## [Unreleased]

## [0.8.0] - 2026-10-08

### Changed

- **Works with both meeting note layouts** from the Meeting Notes plugin: the older one
  (Meeting Summary, Decisions, Action items) and the six-section write-up from its 6.20 update
  (Executive Summary, Next Steps, Summary by Topic, Key Decisions, Additional Items, Speakers).
- **Meeting recap** (starter v3) keeps the summary, next steps or action items, decisions and
  Additional Items in either layout, and leaves out Agenda, Notes, Summary by Topic and Speakers
  (plus the transcript). No "not found" warning on notes that have only some of these.
- **Weekly review** (starter v2) now applies to notes with `type: weekly-review`, wherever they
  are. Before, it only matched a `Weekly Reviews` folder at the top of the vault, so reviews in
  the meeting-notes folder or the Meeting Hub were missed.
- **Digest sections** default: Decisions, Action items, Key Decisions, Next Steps. If you never
  changed the list, it updates automatically; an edited list is left alone.

Unedited copies of the two starters update automatically; edited copies are left alone.

## [0.7.0] - 2026-10-07

### Added

- **Digest packs:** the pack dialog's new **Content** choice, **Digest: only these
  sections**, keeps just the named sections from every note (default: Decisions and Action
  items). Typical use: one compact page of this week's decisions and action items.
  - Subsections come along; excluded sections (for example Transcript) stay excluded; empty
    placeholder sections are skipped.
  - Notes with none of the sections are left out, with a count. If no note has any, nothing
    prints and a notice explains why.
  - Compact layout by default (no cover, contents or page break per note; each can be turned
    back on). The title becomes "Digest: <pack title>".
  - Settings → Packs → **Digest sections** sets the default list.

This is a packs-only exception to the exclude-only rule, approved by Brian on 2026-10-07.

## [0.6.1] - 2026-10-07

### Changed

- Meeting starters (Meeting notes, Meeting recap, Meeting full (with transcript)) are now
  marked as verified against live notes (`starter-version: 2`). Unedited installed copies
  update automatically; edited copies are left alone.

## [0.6.0] - 2026-10-07

### Added

- **Multi-note packs:** print or save several notes as one document.
  - Start from: right-click a folder → **Print folder…**; select notes (Cmd-click) →
    **Print selected notes…**; or the commands **Print a folder…** and **Print notes by tag or
    property…** (`#tag` or `property: value`).
  - Pack dialog: include subfolders; order by date, name or last modified, with ↑/↓ to adjust;
    an optional date range (date property or a date in the file name); per-note checkboxes;
    sections from each note's own defaults or one preset for all; cover page, contents and
    "each note on a new page" (all on by default); Print or PDF.
  - Each note gets its title plus its location and last-modified time. Links between notes in
    the pack jump within the document (clickable in the PDF).
  - Header: pack title | number of notes. Footer: Printed | Page X of Y.
  - Progress notice while rendering; asks before packs over 50 notes; a note that fails is
    reported and the rest still print.

### Changed

- Quick print and packs share one function for a note's default sections, so they always
  agree with the dialog.

## [0.5.0] - 2026-10-07

### Added

- Page header and footer on printouts and PDFs (setting **Header and footer**, on by default):
  - header: the note's folder and name (left) and **Last modified** date and time (right);
  - footer: **Printed** date and time (left) and **Page X of Y** (right).
    PDFs use Electron's header and footer templates; the print panel uses CSS page-margin boxes.
    All values are escaped.

### Changed

- Margins are limited to 0.4-3 inches so the header and footer are not clipped.

## [0.4.0] - 2026-10-07

Release candidate for 1.0.0 (M5: hardening and documentation).

### Added

- **Copy diagnostics** button in settings. The report covers versions, Electron
  capabilities, adapters, preset load results and a settings summary, with no note content.
  "Show diagnostics" shows the same report.
- Debug logging includes parse and render timings.

### Changed

- Diagnostics no longer prints the Obsidian window to an in-memory PDF; capability detection is
  enough now that one-click PDF is confirmed.

### Fixed

- Preset loading can no longer cause an unhandled error; problems appear in the validation
  report instead.
- Opening a preset from **Open print preset…** reports failures with a notice.

### Documentation

- Complete README with fresh-vault BRAT install steps and a 60-second quick start; user guide
  with a settings and commands reference; troubleshooting; architecture with the pipeline and
  how to add an adapter; testing with the test file map; final validation table; full manual
  QA checklist.

## [0.3.1] - 2026-10-07

### Changed

- One-click PDFs no longer go next to the note by default. New setting **Save PDF files to**:
  - **Ask where to save** (default): the macOS Save panel opens on the Desktop with the file
    name filled in; it asks before replacing a file.
  - **Desktop**: saved there directly; never overwrites (` (2)`).
  - **The vault**: the previous behavior (PDF folder, or next to the note).

  A preset with its own `pdf-folder` still saves into the vault.

- Cancelling the Save panel cancels quietly; it does not open the print dialog.

## [0.3.0] - 2026-10-07

One-click PDF (M4). Not yet confirmed on macOS by the owner; see the release notes.

### Added

- PDF adapter: renders the note in a hidden Electron window (JavaScript disabled), checks the
  `%PDF-` header and saves into the vault. The file goes next to the note or into the PDF
  folder, named by the file name template; existing files are never overwritten (` (2)`).
- Automatic fallback: when one-click PDF is unavailable or fails, a notice explains why and
  the print dialog opens.
- Command **Save current note as PDF**. The dialog's Output menu lists PDF when available.
- Settings: default output, PDF folder, PDF file name (with a live example), open PDF after
  saving.
- Vault images are inlined into the PDF. The temporary HTML file lives in the plugin folder
  and is always removed; crash leftovers are cleaned on load.

### Changed

- **Quick print** always prints, regardless of the default output.

### Fixed

- `docs/ARCHITECTURE.md` module table, which had missed the M2 and M3 updates.

## [0.2.0] - 2026-10-07

Presets (M3). Not yet confirmed on macOS by the owner; see the release notes.

### Added

- Presets as Markdown files in a vault folder (default `Print Presets`), schema
  `preset-version: 1`. They load on startup and reload when changed.
- Matching by property, tag, folder and filename, with specificity ordering; every match is
  listed in the dialog, with the most specific selected.
- Note properties `print-preset` (force a preset) and `print-exclude` (complete exclusion
  list; replaces preset and global lists). The dialog tags note exclusions "note".
- Dialog: **Remember for this note** (writes `print-exclude` via `processFrontMatter`) and
  **Save as new preset…**. Drift warnings ("not found: X") for preset headings.
- Validation: errors and warnings per file and field; unreadable YAML reported. Command
  **Validate print presets** and a summary in settings.
- Starter presets installed on first run (Meeting notes, Meeting recap, Meeting full (with
  transcript), Meeting tracker, Weekly review). Upgrades never overwrite edited starters.
  Command and button **Install / refresh starter presets**.
- Commands **Open print preset…** and **Install / refresh starter presets**.
- Settings: presets folder, starters, validation report.
- Presets' `output.paper` and `output.orientation` override the settings.

### Changed

- `minAppVersion` raised to 1.5.7 (vault file lookup APIs).

## [0.1.0] - 2026-10-07

First usable build (M2). Not yet confirmed on macOS by the owner; see the release notes.

### Added

- Review dialog: section checklist with nested tri-state parents, size hints, "global" and
  "empty" tags, Select all / none / Reset / Invert, include title, properties (None / All /
  Choose…), skip empty sections, live summary, warnings, keyboard support.
- Print adapter: hidden sandboxed iframe and the macOS print panel; the note title is
  proposed as the PDF filename.
- Render pipeline: Obsidian renderer, off screen, waiting for async content (8 s limit,
  with a notice).
- Shared print stylesheet: Neutral (light) or Match theme (experimental); paper, orientation
  and margins from settings.
- Header icon (Shift-click skips the dialog), commands "Print / export current note…" and
  "Quick print current note (preset defaults)", file and editor context menus, optional
  ribbon icon.
- Settings: always review, global exclude list (prepopulated with `Transcript`, editable,
  regex validation, Reset to default), skip empty, paper, orientation, margins, print style,
  header and ribbon icons, debug logging.
- Built-in presets "Default" (global list) and "Everything".

### Changed

- `minAppVersion` raised to 1.2.3, the oldest version with every API used (checked by
  `eslint-plugin-obsidianmd`).

### Removed

- Spike A print commands, replaced by the real Print command. "Show diagnostics" stays.

## [0.0.1] - 2026-10-07

Internal spike pre-release for Gate A testing via BRAT. Not for daily use.

### Added

- M0: repository scaffold (strict TypeScript, esbuild, ESLint with the Obsidian ruleset,
  Prettier, Vitest, CI and release workflows), settings schema v1 with migration.
- M0: Spike A commands (print a fictional sample note from a hidden iframe, with and
  without an iframe sandbox) and Spike B "Show diagnostics" command (Electron capability
  detection and an in-memory `printToPDF` probe).
- M1: pure core engine: section parser, exclusion resolution, content filters, preset
  schema validation and matching, filename templates.
