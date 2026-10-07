# CLAUDE.md: Selective Print (Obsidian plugin)

You are building **Selective Print**, an Obsidian desktop plugin (macOS only) that prints notes and exports them to PDF with section-level control. Owner: Brian.

- **`SPEC.md`** defines *what* to build (requirements, schemas, architecture, acceptance criteria).
- **This file** defines *how and when to proceed, and when to stop and ask*. It is authoritative for process. If this file and `SPEC.md` conflict, stop and ask Brian.
- The build happens in **passes**, separated by **stop gates** where Brian tests on his Mac and makes decisions. Never run through a gate.

---

## 1. Start of every session (do this before anything else)

1. Read, in order: `CLAUDE.md`, `SPEC.md`, `STATUS.md`, `docs/VALIDATION.md`, `CHANGELOG.md`, `docs/BACKLOG.md`.
2. State in one short paragraph: current version, current pass, what is done, what is next, and which gate (if any) you are waiting on.
3. If `STATUS.md` says a gate is open and Brian has not reported results, **stop and remind him what is needed**. Do not continue building.
4. If this is the very first session (no `STATUS.md`), do **Gate 0** (section 4) before writing code.

You cannot operate the Obsidian GUI or a physical printer. Assume that. If you ever can (for example through an automation tool), Brian's reported results are still the source of truth at every gate.

---

## 2. Roadmap

| Pass | Milestones | Ends at | Release |
|---|---|---|---|
| **1** | M0 scaffold + spikes, M1 pure core | **Gate A** | none (internal) |
| **2** | M2 review dialog, global exclude list, Print adapter | **Gate B** | **0.1.0** (BRAT) |
| **3** | M3 presets as vault files, matching, starters | **Gate C** | **0.2.0** |
| **4** | M4 PDF adapter with fallback | **Gate D** | **0.3.0** |
| **5** | M5 hardening, docs, full QA | **Gate E** | **1.0.0** |
| Post-1.0 | M6 (1.1) HTML/Markdown adapters, safe-to-share, URI, footer; M7 (1.2) sidebar panel; M8 (1.3) packs, embed heading filtering | **Gate F** before each | 1.1, 1.2, 1.3 |

**Version 1.0 means:** feature-complete for daily use on Brian's Mac: filtered Print and one-click PDF, review dialog, global exclude list (`Transcript` prepopulated), presets and starters, complete docs and tests, and the manual QA checklist run by Brian. Everything else is post-1.0.

Milestone details and acceptance criteria are in `SPEC.md` section 10. Do not start a pass until the previous gate is closed.

---

## 3. Non-negotiables

1. **macOS desktop only.** No Windows/Linux/mobile code paths. `isDesktopApp` and macOS checks show a clear notice otherwise.
2. **No coupling to other plugins.** Never read, import, detect or integrate with any other plugin's code, settings or data. Starter presets are static data files that match a note format. The plugin sees only note files in the vault.
3. **Exclude-only through v1.0.** No include lists, no include-only mode, no `print-include`. Those are in the backlog.
4. **Default behavior:** the global exclude list is prepopulated with `Transcript`; the review dialog lists excluded sections unchecked so Brian can opt in at print time; "Always review before output" defaults to on.
5. **No network access, telemetry, accounts or remote services.** Ever.
6. **Pure core.** Everything in `src/core/` takes plain data and has no Obsidian or DOM imports. Business logic never lives in `main.ts`, triggers or modals.
7. **Fail loudly, degrade gracefully.** Every adapter failure shows a `Notice` with the reason and, where possible, a fallback. No silent failures, no unhandled rejections. Safe-to-share (v1.1) fails closed.
8. **Never lose or overwrite user data.** Never overwrite a user-modified preset, an existing output file, or note content without explicit confirmation. Notes are only modified via `processFrontMatter` and only when Brian clicks "Remember".
9. **Confidentiality.** Fixtures, examples and docs use fictional data only. No real customer, company-internal or personal content in the repo.

---

## 4. Stop gates

At every gate: finish the pass, update `STATUS.md`, post the pass-end summary (section 6), then **stop and wait**. Do not begin the next pass in the same session unless Brian explicitly says the gate is closed.

| Gate | When | You provide | Brian provides / decides | Do not proceed until |
|---|---|---|---|---|
| **0** | Before any code | One message with these questions, then wait: (1) Obsidian and macOS versions you run? (2) Path of the dev/test vault? (3) Confirm defaults: public GitHub repo, MIT license, repo name `selective-print`? (4) Presets folder name `Print Presets` OK? | Answers. Unanswered items use the stated defaults, recorded in `STATUS.md`. | Brian has answered or said "use defaults" |
| **A** | End of Pass 1 (M0 + M1) | Spike A and B built; `docs/SPIKE_RESULTS.md` with a numbered test checklist; a one-page summary of the core API (function signatures, selection precedence) and fixture list | Runs the spikes on his Mac and reports: does the print dialog open; does the PDF dropdown appear; what filename it proposes; the diagnostics output (is Electron `remote.BrowserWindow` / `printToPDF` available); any console errors. Provides **anonymized** samples: one generated meeting note including a Krisp transcript, one weekly review, one meeting tracker. Approves the core semantics. | Brian reports results and approves the core. **Decision here:** if Spike A fails, propose an alternative print path and wait. If Spike B shows `remote` is unavailable, propose how M4 changes (fallback-only PDF via the print dialog, or another route) and wait for approval. |
| **B** | End of Pass 2 → release **0.1.0** | BRAT-installable build; `docs/MANUAL_QA.md` items 1-8 ready with exact steps | Runs QA items 1-8 and reports pass/fail per item, plus UX feedback on the dialog, header icon and defaults | Brian reports results. Fix failures before Pass 3. |
| **C** | End of Pass 3 → release **0.2.0** | Installed starter presets, an example preset file, `docs/PRESETS.md`, validation report output | Reviews the preset schema and starters; **verifies starter heading names against real notes**; confirms matching behavior. **Schema decision:** after this gate, `preset-version: 1` is frozen. Later changes require a migration plus a gate. | Brian approves the schema or requests changes |
| **D** | End of Pass 4 → release **0.3.0** | PDF adapter and fallback; QA items 9-10 ready | Runs items 9-10; confirms the fallback message is clear; decides whether to keep "open in Preview" | Brian reports results |
| **E** | End of Pass 5 → release **1.0.0** | Complete docs, final `VALIDATION.md`, release notes, fresh-vault BRAT install steps | Runs the **full** QA checklist; reviews docs; confirms the release (repo visibility, release notes, tag) | Brian signs off. Any unchecked QA item is listed as **unverified** in the release notes. |
| **F** | Before each post-1.0 version | A one-page scope (what, why, risks, tests, docs) | Approves, trims or defers the scope | Brian approves the scope |

---

## 5. Stop-and-ask triggers (any time, not just at gates)

Stop and ask Brian, with your recommendation, before:

- Adding a runtime dependency (justify it; prefer none).
- Changing a schema (`preset-version`, settings `schemaVersion`, note frontmatter keys) or any behavior that could break existing presets or settings.
- Any API (Obsidian or Electron) that does not behave as the typings or docs suggest, or whose use depends on an undocumented or deprecated feature beyond what `SPEC.md` already names (`remote` is the one named exception, isolated in `electron-bridge.ts`).
- Anything that writes outside the vault, deletes or overwrites files, or modifies note content.
- Any feature not in the current milestone. Add it to `docs/BACKLOG.md` instead.
- Any decision that touches security (HTML escaping, path handling, URI parameters) and is not already covered in `SPEC.md` section 5.
- Anything that would make the plugin read, detect or interact with another plugin.
- A milestone taking significantly more effort than expected, or a requirement that turns out to be infeasible.

Ask in one concise message: the problem, the options with tradeoffs, your recommendation, and what changes if Brian picks differently.

---

## 6. Pass protocol

### During a pass

- Restate the milestone and list the files you will create or change before coding.
- Work core-first: write and test pure modules before UI.
- Commit per logical step, then tag at release. Message format: `m2: add review modal section tree` (milestone prefix, imperative, specific).
- Keep it small and boring. Readable code over clever code.
- Verify Obsidian and Electron API signatures against the installed typings and docs. Record assumed versions in `docs/ARCHITECTURE.md`.
- Docs and tests are part of the work, not a follow-up.

### Definition of done (every milestone)

- Acceptance criteria in `SPEC.md` are met.
- `npm run lint && npm run typecheck && npm test && npm run build` are all green.
- New behavior has unit tests; any bug fix has a regression test.
- Relevant docs updated; `CHANGELOG.md` entry added; `docs/VALIDATION.md` status table updated.
- Manual QA items for the milestone are written with exact steps.
- `STATUS.md` updated.

### End of a pass: summary format (post this, then stop)

1. **Done:** what was built, mapped to acceptance criteria (met / not met).
2. **Verification:** commands run and results; test count and core coverage.
3. **Unverified:** everything that needs Brian's Mac (print dialog, `remote`, `printToPDF`, Preview, theme rendering). Never write "works on macOS" unless Brian reported it.
4. **Deviations and assumptions:** anything you decided that the spec did not say.
5. **Brian to do:** the numbered test checklist for this gate.
6. **Questions / decisions needed.**
7. **Next pass:** what happens once the gate closes.

### `STATUS.md` (create in M0, update at every pass end)

```markdown
# STATUS
- Version: <x.y.z>   Pass: <n>   Milestone: <Mx>
- Gate: <A|B|C|D|E|F|none>   State: <open: waiting on Brian | closed>
## Done
## In progress
## Waiting on Brian
## Decisions made (with date and who decided)
## Assumptions in force (Obsidian/macOS versions, defaults taken)
## Known issues
## Next
```

---

## 7. Engineering rules

- TypeScript `strict`; no `any` without a comment; ESLint with the Obsidian plugin ruleset; Prettier.
- Settings in `data.json` with a `schemaVersion` and a migration function from day one. Presets carry `preset-version`.
- Lifecycle hygiene: `registerEvent`, `registerDomEvent`, `addCommand`; remove injected DOM, iframes and temp files on unload; no global listeners left behind; header actions re-attached on `layout-change` and `file-open` without duplicates.
- Security: build DOM with `createEl`/DOM APIs, not `innerHTML` with untrusted strings; strip `<script>` from rendered output; escape every value interpolated into HTML; confine paths to the vault with `normalizePath`; treat URI parameters as untrusted.
- Print adapter must not inject or execute scripts in the iframe.
- Electron access only through `src/output/electron-bridge.ts` with capability detection and a fallback.

---

## 8. Versioning and compatibility

- Semantic versioning. Tag name equals the `manifest.json` version exactly (no `v` prefix), because BRAT and Obsidian match on it.
- Update `manifest.json`, `package.json` and `versions.json` together (`version-bump.mjs`). Release assets: `main.js`, `manifest.json`, `styles.css`.
- Backward compatibility is a feature: a settings or preset change that breaks existing user data needs a migration and a gate.
- Starter presets carry `starter-version`; upgrades add new starters and update only unmodified ones (see `SPEC.md` section 4).

### Release procedure

1. Confirm the gate for this version is closed (or, for a release at a gate, that the summary has been posted).
2. Update `CHANGELOG.md`, bump versions, run the full check suite.
3. Commit, tag, push; the release workflow attaches the three assets.
4. Verify the BRAT install steps in `README.md` against the release.
5. Note unverified QA items in the release notes.

---

## 9. Handling bug reports from Brian

1. Reproduce with a fixture or a minimal note first. If you cannot reproduce, ask for the Obsidian version, the note structure (anonymized) and the console output (the plugin logs with the `[SelectivePrint]` prefix when debug logging is on).
2. Add a failing test before fixing.
3. Fix, confirm the test passes, add a CHANGELOG entry, and say clearly whether the fix needs Mac verification.

---

## 10. Scope control

- `docs/BACKLOG.md` holds everything not in the current milestone: include lists/include-only mode, PDF bookmarks, DOCX via Pandoc, and any new idea.
- Do not build ahead, even if it seems easy.
- Do not rename identifiers, change the plugin id, or restructure the repo layout without asking.

---

## 11. Pass 1 checklist (M0 + M1), then stop at Gate A

1. Do **Gate 0** and wait for answers.
2. Scaffold the repo per `SPEC.md` section 5: build, lint, typecheck, test, CI, release workflow, `manifest.json` (`isDesktopOnly: true`), `LICENSE` (MIT), `STATUS.md`, `docs/BACKLOG.md`, doc stubs, `styles.css`, `print.css` stub.
3. Build **Spike A** (hidden-iframe print command) and **Spike B** (diagnostics command) only; no dialog, no presets yet.
4. Write `docs/SPIKE_RESULTS.md` with the numbered Mac test checklist.
5. Implement M1: `sections`, `selection`, `filter`, `presets`, `filename`, with the fixtures and tests in `SPEC.md` section 7.1. Meet the coverage target.
6. Post the pass-end summary including the core API summary and fixture list.
7. **Stop at Gate A.**
