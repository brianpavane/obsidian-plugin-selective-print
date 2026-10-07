# STATUS

- Version: 0.0.1 (internal spike pre-release on GitHub, for BRAT testing) Pass: 1 Milestone: M0 + M1 complete
- Gate: A State: **open: waiting on Brian**

## Done

- Gate 0 answered (2026-10-07).
- M0: scaffold (strict TS, esbuild, ESLint + Obsidian ruleset, Prettier, Vitest, CI, draft-release
  workflow), `manifest.json` (`isDesktopOnly: true`), MIT `LICENSE`, settings schema v1 with
  migration, docs stubs, `styles.css`, `print.css` stub.
- M0: Spike A (hidden-iframe print, sandboxed and unsandboxed variants) and Spike B
  ("Show diagnostics" with Electron capability detection and an in-memory `printToPDF` probe).
  Test checklist in `docs/SPIKE_RESULTS.md`.
- M1: pure core: `sections`, `selection`, `filter`, `presets`, `filename`. 112 tests; core
  coverage 100% lines and 96% branches; round-trip property test; pure-core rule enforced by
  ESLint.

## In progress

Nothing. Stopped at Gate A.

## Waiting on Brian

1. Run the spike checklist in `docs/SPIKE_RESULTS.md` (A1-A7, B1-B2, C1) and report the results.
2. Anonymized samples: one generated meeting note with a Krisp transcript, one weekly review,
   one meeting tracker (fictional content, real headings).
   Core semantics below: **approved by Brian on 2026-10-07** ("Approve All"; open to change later):
   1. Rules match heading text trimmed and case-insensitive, at any level, against the plain
      text (`## [[Transcript]]` and `## **Transcript**` match `Transcript`) or the raw text.
   2. `regex:` rules are case-insensitive.
   3. Rules never match the Preamble pseudo-section.
   4. When a preset and the global list both exclude a heading, the dialog tag says `preset`.
   5. Section id format: `<level>:<plain title>#<occurrence>`, e.g. `2:Notes#2`.
   6. "Empty" also counts Obsidian `%% comments %%` (they do not render), in addition to the
      spec's whitespace, empty list markers, empty checkboxes and HTML comments. `- [x]` with
      no text is empty too.
   7. A parent section is "empty" only when its own content and all children are empty.
   8. `%% print:exclude %%` regions do not cross headings: an open region ends at the next
      heading, with a warning.
   9. Preset matchers: `property` requires `equals`; values compare as case-insensitive text;
      a list-valued property matches if any item equals. Tags match nested tags (`customer`
      matches `customer/contoso`). Folders include subfolders, case-insensitive.
   10. Specificity ties: more conditions in one entry first, then by name.
   11. Unknown top-level or section keys in a preset are **warnings** (the preset still
       loads). Unknown matcher keys are **errors**, so a typo cannot silently widen a match.
   12. Duplicate preset names (case-insensitive): the first file by path wins and the others
       are reported and skipped. "Default" and "Everything" are reserved.
   13. Preset fields that have a settings counterpart (`skip-empty`, `output.*`) fall back to
       plugin settings when omitted.
   14. Filenames: strip `/ \ : * ? " < > |` and control characters, collapse whitespace, cap at
       120 characters, fall back to `Untitled`. `{datetime}` is `YYYY-MM-DD HHmm`.
       `{date}` uses the note's `date` property if valid, otherwise today.

## Decisions made

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
- `minAppVersion` 1.1.0 is provisional (see `docs/ARCHITECTURE.md`).
- The meeting fixture's headings come from SPEC section 4 (README-based), not live notes.
- `npm audit` reports `moment` (moderate) via the dev-only `obsidian` typings package. It is
  not bundled into `main.js`.

## Known issues

- Spike A cannot set the print margin, paper or orientation from settings yet (M2).
- No settings tab yet. Debug logging can only be enabled via `data.json` (see
  `docs/SPIKE_RESULTS.md`).

## Next

After Gate A closes: Pass 2 (M2): review dialog, global exclude list in settings, Print
adapter with render pipeline and settle detector, header icon and commands. Ends at Gate B
with release 0.1.0. If a spike fails, its replacement path is agreed first.
