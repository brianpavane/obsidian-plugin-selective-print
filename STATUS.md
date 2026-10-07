# STATUS

- Version: 0.2.0 Pass: 3 Milestone: M3 complete
- Gate: C State: **open: waiting on Brian**

## Done

- Pass 1 (M0 + M1): scaffold, spikes, pure core. Gate A closed 2026-10-07.
- Pass 2 (M2): dialog, Print adapter, settings, header icon. Release 0.1.0. Gate B closed
  2026-10-07.
- Pass 3 (M3): presets as vault files (load, watch, validate), matching with specificity,
  `print-preset` / `print-exclude`, Remember for this note, Save as new preset, starters with
  upgrade rules, Validate / Open preset / Install starters commands, presets settings.
  142 tests; core coverage 100% lines. Release 0.2.0 published for BRAT.

## In progress

Nothing. Stopped at Gate C.

## Waiting on Brian

1. Update to 0.2.0 and try the Gate C list in `docs/MANUAL_QA.md` (6 items).
2. **Verify the starters' heading names against your real notes** (Meeting Summary, Agenda,
   Notes, Decisions, Action items, Transcript). Tell me the real names, or send the anonymized
   samples.
3. **Schema decision:** approve `preset-version: 1` as described in `docs/PRESETS.md`. After
   this gate it is frozen; later changes need a migration and a gate.
4. Decide on the starter matcher deviation below (keep, or change).

## Core semantics (approved by Brian on 2026-10-07, open to change)

See `docs/ARCHITECTURE.md` for precedence. The 14 approved choices: plain-text heading
matching, case-insensitive regex, Preamble never matched, "preset" tag wins over "global",
ids `<level>:<title>#<n>`, `%%` comments count as empty, parents are empty only when their
whole subtree is, marker regions stop at headings, matcher rules (property needs equals; tags
nested; folders recursive), specificity tie-breaks, unknown preset keys warn but unknown
matcher keys are errors, duplicate preset names (first by path wins; built-in names
reserved), preset fields fall back to settings, and the filename rules.

## Decisions made

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

After Gate C closes: Pass 4 (M4): one-click PDF through Electron (`printToPDF`) when it is
available, otherwise a fallback to the print dialog with a notice; filename templates;
optional open in Preview. Ends at Gate D with release 0.3.0.
