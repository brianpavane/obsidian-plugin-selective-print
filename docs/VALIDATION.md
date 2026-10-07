# Validation status

The honest status of each capability: **automated** (unit tests in CI), **manual-verified on
<versions>** (reported by Brian), or **unverified**. "Works on macOS" is only ever written
here from Brian's reports.

| Capability                                                               | Milestone  | Status                                          | Evidence                                                      |
| ------------------------------------------------------------------------ | ---------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Section parser (fences, setext, frontmatter, comments, round-trip)       | M1         | automated                                       | `test/sections.test.ts`, including a property test (500 runs) |
| Exclusion precedence (dialog > note > preset+global > global > none)     | M1         | automated                                       | `test/selection.test.ts`                                      |
| Global list default (`Transcript`), case, regex, nesting, duplicates     | M1         | automated                                       | `test/selection.test.ts`                                      |
| Drift warnings for presets                                               | M1         | automated                                       | `test/selection.test.ts`                                      |
| Content filters (markers, callouts, skip-empty, properties)              | M1         | automated                                       | `test/filter.test.ts`                                         |
| Preset schema v1 validation and matching                                 | M1         | automated                                       | `test/presets.test.ts`                                        |
| Filename templates and sanitizing                                        | M1         | automated                                       | `test/filename.test.ts`                                       |
| Settings migration                                                       | M0         | automated                                       | `test/settings.test.ts`                                       |
| 10k+ line note parses and filters in < 500 ms                            | M1         | automated                                       | performance tests (Node, not Obsidian)                        |
| Plugin loads in Obsidian (0.0.1)                                         | M0         | manual-verified on Obsidian 1.14.4 / macOS 26.7 | Brian, Gate A, 2026-10-07 (implied by A1)                     |
| Hidden-iframe print opens the macOS print panel; PDF dropdown works      | M0 Spike A | manual-verified on Obsidian 1.14.4 / macOS 26.7 | Brian, Gate A A1-A3, 2026-10-07                               |
| Spike A proposed filename, cancel cleanup, dark theme (A3 detail, A4-A7) | M0 Spike A | **unverified**                                  | Waived at Gate A                                              |
| Electron `remote` / `BrowserWindow` / `printToPDF` available             | M0 Spike B | **unverified**                                  | Waived at Gate A; runtime detection in M4                     |
| Dialog state (tri-state, quick actions, size hints)                      | M2         | automated                                       | `test/dialog-state.test.ts`                                   |
| Selection exactly controls the rendered source (snapshot)                | M2         | automated                                       | `test/job.test.ts`                                            |
| Review dialog, Print adapter, header icon, settings tab (QA items 1-8)   | M2         | **unverified**                                  | Gate B                                                        |
| Core coverage                                                            | M1         | automated                                       | 100% lines, 96% branches in `src/core/`                       |

## Manual QA log

| Date       | Obsidian | macOS | Plugin | Item        | Result                                                   |
| ---------- | -------- | ----- | ------ | ----------- | -------------------------------------------------------- |
| 2026-10-07 | 1.14.4   | 26.7  | 0.0.1  | Spike A1-A3 | pass (reported as "seemed to work, at least through A3") |
