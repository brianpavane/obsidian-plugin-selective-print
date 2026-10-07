# Validation status

The honest status of each capability: **automated** (unit tests in CI), **manual-verified on
<versions>** (reported by Brian), or **unverified**. "Works on macOS" is only ever written
here from Brian's reports.

| Capability                                                           | Milestone  | Status         | Evidence                                                      |
| -------------------------------------------------------------------- | ---------- | -------------- | ------------------------------------------------------------- |
| Section parser (fences, setext, frontmatter, comments, round-trip)   | M1         | automated      | `test/sections.test.ts`, including a property test (500 runs) |
| Exclusion precedence (dialog > note > preset+global > global > none) | M1         | automated      | `test/selection.test.ts`                                      |
| Global list default (`Transcript`), case, regex, nesting, duplicates | M1         | automated      | `test/selection.test.ts`                                      |
| Drift warnings for presets                                           | M1         | automated      | `test/selection.test.ts`                                      |
| Content filters (markers, callouts, skip-empty, properties)          | M1         | automated      | `test/filter.test.ts`                                         |
| Preset schema v1 validation and matching                             | M1         | automated      | `test/presets.test.ts`                                        |
| Filename templates and sanitizing                                    | M1         | automated      | `test/filename.test.ts`                                       |
| Settings migration                                                   | M0         | automated      | `test/settings.test.ts`                                       |
| 10k+ line note parses and filters in < 500 ms                        | M1         | automated      | performance tests (Node, not Obsidian)                        |
| Plugin loads in Obsidian; commands appear                            | M0         | **unverified** | Gate A, step C1                                               |
| Hidden-iframe print opens the macOS print panel                      | M0 Spike A | **unverified** | Gate A, steps A1-A7                                           |
| PDF dropdown proposes the document title as filename                 | M0 Spike A | **unverified** | Gate A, step A3                                               |
| Electron `remote` / `BrowserWindow` / `printToPDF` available         | M0 Spike B | **unverified** | Gate A, step B1                                               |
| Core coverage                                                        | M1         | automated      | 100% lines, 96% branches in `src/core/`                       |

## Manual QA log

| Date       | Obsidian | macOS | Plugin | Item | Result |
| ---------- | -------- | ----- | ------ | ---- | ------ |
| _none yet_ |          |       |        |      |        |
