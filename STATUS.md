# STATUS

- Version: 0.4.0 (release candidate for 1.0.0) Pass: 5 Milestone: M5 complete
- Gate: E State: **open: waiting on Brian**

## Done

- Passes 1-4 (M0-M4): core, dialog, Print, presets, one-click PDF. Gates A-D closed on
  2026-10-07. Releases 0.1.0, 0.2.0, 0.3.0, 0.3.1.
- Pass 5 (M5): Copy diagnostics (no note content, tested), debug timings, hardening (no
  unhandled rejections from preset loading or the preset picker), a performance test on a
  12k-line note, complete docs (README with fresh-vault BRAT steps, user guide, presets,
  troubleshooting, architecture, testing, validation, manual QA), draft 1.0.0 release notes
  (`docs/RELEASE_NOTES_1.0.0.md`). 163 tests. Release candidate 0.4.0 published for BRAT.

## In progress

Nothing. Stopped at Gate E.

## Waiting on Brian

1. Update to 0.4.0 and try the Gate E list in `docs/MANUAL_QA.md` (5 items). Report in plain
   words.
2. Review the docs if you want (README and user guide are the user-facing ones).
3. Sign off on 1.0.0: confirm the release (repo stays public, release notes, tag `1.0.0`).
   Anything not confirmed is listed as unverified in the release notes.

## Core semantics (approved by Brian on 2026-10-07, open to change)

See `docs/ARCHITECTURE.md` for precedence. The 14 approved choices: plain-text heading
matching, case-insensitive regex, Preamble never matched, "preset" tag wins over "global",
ids `<level>:<title>#<n>`, `%%` comments count as empty, parents are empty only when their
whole subtree is, marker regions stop at headings, matcher rules (property needs equals; tags
nested; folders recursive), specificity tie-breaks, unknown preset keys warn but unknown
matcher keys are errors, duplicate preset names (first by path wins; built-in names
reserved), preset fields fall back to settings, and the filename rules.

## Decisions made

- 2026-10-07, Brian: Gate D closed. 0.3.1 confirmed: "it allowed me to save on the desktop".
  "Open PDF after saving" kept as an option, off by default (no objection raised).

- 2026-10-07, Brian: one-click PDFs should go to the Desktop or ask where to save, not next to
  the note. This deviates from SPEC 3.6 ("write to the configured vault folder") and allows
  writing **outside the vault** (CLAUDE.md section 5), at Brian's request. Implemented as
  "Save PDF files to": Ask (default, Save panel on the Desktop) / Desktop / The vault. Files
  outside the vault are written only to the Desktop or to a path the user picked in the Save
  panel.
- 2026-10-07, Brian (Spike B answered): Electron `remote`, `BrowserWindow` and `printToPDF`
  work on Obsidian 1.14.4 / macOS 26.7.

- 2026-10-07, Claude: the PDF adapter's temporary HTML file is written inside the vault, in the
  plugin folder (`.obsidian/plugins/selective-print/.print-tmp-*.html`), not the system temp
  folder. This avoids writing outside the vault (CLAUDE.md section 5). It is removed after
  every run and on load.
- 2026-10-07, Claude: "open in Preview" uses `shell.openPath`, which opens the default PDF app
  (Preview unless changed).

- 2026-10-07, Brian: Gate C closed ("All good to me") in reply to the Gate C list and
  decisions. Approved: `preset-version: 1` is now **frozen** (changes need a migration and a
  gate); the starter matcher deviation (only "Meeting notes" matches `type: meeting`). Starter
  heading names were not separately confirmed; they stay marked "verified against README".

- 2026-10-07, Claude (pending Brian at Gate C): "Meeting recap" and "Meeting full (with
  transcript)" ship **without** the `type = meeting` matcher that SPEC section 4 lists. With
  three equally specific matches, the alphabetical first ("Meeting full") would be the
  default and would include the transcript, against the "Transcript excluded by default"
  rule. "Meeting notes" stays the automatic default; the other two are one click away in the
  preset menu. Alternative: a `priority` key (schema change; in the backlog).
- 2026-10-07, Claude: settings gained `installedStarters` (additive, default `{}`; no
  `schemaVersion` bump, the migration fills it in). Needed for the "do not re-create deleted
  starters" rule.
- 2026-10-07, Claude: the command "Open presets folder" (SPEC 3.7) is implemented as
  **Open print preset…**, a picker of preset files. Obsidian has no public API to reveal a
  folder in the file explorer.

- 2026-10-07, Brian: Gate B closed ("let's keep going") after reporting on 0.1.0: "Print works,
  and the option to include/exclude empty sections works." No failures reported; the other
  QA items stay unverified.

- 2026-10-07, Brian: Gate A closed after A1-A3 passed (the print panel opens from the iframe,
  the PDF dropdown works). A4-A7, B1-B2 and C1 were waived: Brian tests by using the plugin,
  not with debug checklists. Spike B (Electron PDF capability) moves to M4, where the PDF
  adapter detects it at runtime and falls back to the print dialog. Sample notes are deferred
  to Gate C.

- 2026-10-07, Brian: approved all 14 core semantics listed under "Waiting on Brian".
- 2026-10-07, Brian: push to GitHub and publish `0.0.1` as a GitHub **pre-release** so the spikes
  can be installed with BRAT. This deviates from the roadmap ("Pass 1: no release"); the build is
  marked internal and not for daily use.

- 2026-10-07, Brian (Gate 0): Obsidian 1.14.4 and macOS 26.7.
- 2026-10-07, Brian (Gate 0): use the existing repo
  `github.com/brianpavane/obsidian-plugin-selective-print`; the repo name differs from the
  plugin id `selective-print` (agreed).
- 2026-10-07, Brian (Gate 0): public repo, MIT license, presets folder `Print Presets`.
- 2026-10-07, Brian (Gate 0, "change files as you need"): spec renamed to `SPEC.md`;
  placeholder `README.md` replaced.
- 2026-10-07, Claude (dev tooling only): TypeScript 6.0.3 (typescript-eslint does not support
  TS 7 yet) and ESLint 9 (required by `eslint-plugin-obsidianmd`). No runtime dependencies.

## Assumptions in force

- Obsidian 1.14.4, macOS 26.7. Typings `obsidian@1.13.1` (newest published).
- Dev/test vault path: **not provided**. Spike setup uses a `<vault>` placeholder.
- `minAppVersion` 1.5.7 (from `eslint-plugin-obsidianmd` API data). Only 1.14.4 is tested.
- The meeting fixture's headings come from SPEC section 4 (README-based), not live notes.
- `npm audit` reports `moment` (moderate) via the dev-only `obsidian` typings package. It is
  not bundled into `main.js`.

## Known issues

- Unverified on macOS (Gate B): everything in M2 except the iframe print path itself.
- One-click PDF depends on Electron `remote`, which is deprecated upstream. It works on
  Obsidian 1.14.4; a future Obsidian may drop it, and then the automatic fallback applies.
- PDF: remote (http) images are not inlined; the PDF window loads them as Obsidian does.
- Whether `afterprint` fires on Cancel is unknown (spike A4 was waived). Mitigation: each new
  print cleans up the previous print frame, and a 5-minute timer is the fallback.
- "Match theme" is experimental: Obsidian's own print CSS may interfere.
- With the Neutral style, math (MathJax) may lose formatting, because its styles live in the
  Obsidian window.
- Starter heading names come from the README, not real notes (Gate C item 2).
- "Remember" cannot store every selection exactly (a subheading kept under an excluded
  parent, duplicate heading names, the preamble). The user gets a notice when this happens.
- Settings are not yet in Obsidian 1.13+ settings search (declarative settings API); see the
  backlog.

## Next

When Brian signs off at Gate E: update the release notes from his report, bump to 1.0.0 (same
code as 0.4.0 plus any fixes), tag and publish. Then post-1.0 work (M6: HTML and Markdown
adapters, safe-to-share, URI handler, footer) starts only after a Gate F scope approval.
