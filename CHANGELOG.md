# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Tags equal the version with no `v` prefix.

## [Unreleased]

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
