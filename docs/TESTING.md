# Testing

## Commands

| Command             | What it runs                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test`          | All Vitest unit tests (`test/**/*.test.ts`)                                                                   |
| `npm run coverage`  | Tests plus v8 coverage of `src/core/`, `src/output/adapter.ts` and `src/output/pdf.ts`; fails below 90% lines |
| `npm run lint`      | ESLint (Obsidian ruleset plus pure-core restrictions) and Prettier check                                      |
| `npm run typecheck` | `tsc --noEmit`, strict                                                                                        |
| `npm run build`     | Production bundle (`main.js`)                                                                                 |

CI runs lint, typecheck, coverage and build on every push and pull request.

## Test files

| File                    | Covers                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `sections.test.ts`      | Parser, round-trip property test (fast-check), emptiness, performance                             |
| `selection.test.ts`     | Rules, precedence, global list cases, drift                                                       |
| `filter.test.ts`        | Selection slicing, markers, callouts, skip-empty, properties, pipeline                            |
| `presets.test.ts`       | Schema validation, set validation, matching, specificity, dropdown order, serialization           |
| `filename.test.ts`      | Templates, sanitizing, unique names                                                               |
| `dialog-state.test.ts`  | Tri-state checklist, quick actions, size hints                                                    |
| `job.test.ts`           | Snapshot of the Markdown passed to the renderer; whole-pipeline performance (12k lines)           |
| `note-keys.test.ts`     | `print-exclude` / `print-preset`; Remember list and lossiness                                     |
| `starters.test.ts`      | Bundled starters validate and match; install and upgrade plan                                     |
| `output.test.ts`        | Adapter registry, fallback, PDF adapter (vault, Desktop, Save panel, cancel, failures) with fakes |
| `pack.test.ts`          | Pack dates, sorting, date filter, queries, reordering, labels; shared note defaults               |
| `header-footer.test.ts` | Header and footer labels, escaping, margin boxes, PDF templates                                   |
| `diagnostics.test.ts`   | Diagnostics report content (no note content)                                                      |
| `settings.test.ts`      | Settings defaults and migration                                                                   |

Not testable outside Obsidian, and covered by manual QA instead (`docs/MANUAL_QA.md`): rendering,
the print panel, the hidden PDF window, the Save panel, vault events and the dialog UI.

## How fixtures work

Fixtures are fictional Markdown notes in `test/fixtures/`. Tests load them with
`loadFixture(name)`. Preset fixtures live in `test/fixtures/presets/`.
`fixtureFrontmatter(name)` parses their YAML with the `yaml` dev dependency, standing in for
Obsidian's `parseYaml`, and passes the object to the core, as the Obsidian layer will.

To add a fixture: create the `.md` file with fictional content only, add it to the table below,
and reference it from a test. If it is a note fixture, add it to the round-trip list in
`test/sections.test.ts`.

## Fixture list

| Fixture                                                                                             | Covers                                                                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `nesting.md`                                                                                        | H1/H2/H3 nesting and ranges                                                                          |
| `frontmatter-properties.md`                                                                         | Frontmatter with lists, quoted strings, dates, numbers, booleans; preamble after frontmatter         |
| `duplicate-headings.md`                                                                             | Duplicate names, ids per level and occurrence                                                        |
| `transcript-present.md` / `transcript-absent.md`                                                    | Global list default with and without a Transcript heading                                            |
| `transcript-nested.md`                                                                              | Excluded section takes its subheadings; word and line counts                                         |
| `transcript-duplicated.md`                                                                          | Every occurrence excluded                                                                            |
| `transcript-case.md`                                                                                | Case and whitespace variants; `Transcript (Krisp)` not matched; `regex:` entries                     |
| `fenced-headings.md`                                                                                | Headings inside backtick/tilde fences, HTML comments and `%%` comments are ignored                   |
| `setext-trailing.md`                                                                                | Setext H1/H2, closing `#`s, `C#`, links, emphasis, emoji, thematic break after a list                |
| `preamble.md`                                                                                       | Content before the first heading                                                                     |
| `empty-sections.md`                                                                                 | Placeholder bullets, empty tasks, comments, blank lines, parents with empty or non-empty children    |
| `callouts.md`                                                                                       | Excluded callout types, nested and foldable callouts, case-insensitive types, callouts in code       |
| `exclude-markers.md`                                                                                | Balanced, inline, nested, in-code, unmatched start and stray end markers                             |
| `meeting-generated.md`                                                                              | Generated-style meeting note (headings from SPEC section 4, **not yet verified against live notes**) |
| `meeting-drift-missing.md` / `meeting-drift-renamed.md`                                             | Drift warnings for missing and renamed headings                                                      |
| `presets/valid.md`, `minimal.md`                                                                    | Complete and minimal valid presets                                                                   |
| `presets/missing-keys.md`, `wrong-types.md`, `unknown-keys.md`, `bad-regex.md`, `future-version.md` | Validation errors and warnings                                                                       |
| `presets/duplicate-a.md`, `duplicate-b.md`                                                          | Duplicate names (case-insensitive)                                                                   |

Bundled starters (`starters/*.md`) are tested too: they must validate cleanly, match the
generated meeting fixture, and have no drift against it (`test/starters.test.ts`).

Generated in tests rather than stored as files: the 10k+ line transcript (performance), the
property-based round-trip documents (`fast-check`), and filename template cases.
