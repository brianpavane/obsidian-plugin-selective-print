# Spike results (M0, Gate A)

Status: **built, not yet run on macOS.** Nothing on this page is verified until Brian reports
results. Fill in the "Result" column and send it back, or paste your answers into chat.

## What the spikes answer

| Spike          | Question                                                                                                                                        | Decides                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A: print       | Does `print()` on a hidden iframe inside Obsidian open the macOS print panel, with a working **PDF** dropdown and a sensible proposed filename? | Whether the M2 Print adapter can use the iframe path, or needs an alternative.  |
| B: diagnostics | Are Electron `remote`, `remote.BrowserWindow` and `webContents.printToPDF` available in Obsidian 1.14.4?                                        | Whether M4 builds one-click PDF on `remote`, or falls back to the print dialog. |

## Commands added

| Command (palette)                                                         | What it does                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selective Print: Spike print test: sample note**                        | Renders a fictional sample note into a hidden, sandboxed iframe (no scripts allowed), sets the window title, calls `print()`, cleans up on `afterprint` or after 5 minutes.                                                                                 |
| **Selective Print: Spike print test: sample note without iframe sandbox** | The same, without the `sandbox` attribute. Isolates sandbox effects if the first one fails.                                                                                                                                                                 |
| **Selective Print: Show diagnostics**                                     | Shows Obsidian/Electron/Chrome versions and whether `remote`, `BrowserWindow` and `printToPDF` exist. Runs `printToPDF` **in memory** on the current window and checks the `%PDF-` header. Nothing is written to disk. The report contains no note content. |

## Setup (once, via BRAT)

1. Install and enable the **BRAT** community plugin if you do not have it.
2. Cmd-P → **BRAT: Add a beta plugin for testing**. Enter
   `https://github.com/brianpavane/obsidian-plugin-selective-print` and choose version
   `0.0.1` (a pre-release: an internal spike build, not for daily use).
3. **Settings → Community plugins**: enable **Selective Print**.
4. Open Developer Tools with **Option-Cmd-I** and select the **Console** tab. Keep it open.
5. Optional, for verbose `[SelectivePrint]` logs: quit Obsidian, create
   `<vault>/.obsidian/plugins/selective-print/data.json` containing `{"debugLogging": true}`,
   and reopen. (A settings tab arrives in M2.)

Developer alternative: `npm ci && npm run build`, then symlink the repo to
`<vault>/.obsidian/plugins/selective-print`.

## Brian to test

| #   | Step                                                                                                         | What to look for                                                                                                                                                                                                                    | Result |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1  | Cmd-P → **Spike print test: sample note**                                                                    | Does the macOS print panel open?                                                                                                                                                                                                    |        |
| A2  | Look at the panel's preview                                                                                  | Do you see the heading "Fictional Weekly Sync", a preamble line, Agenda, Notes (bold/italic, a wikilink, a table, a callout, a code block), Action items (checkboxes) and Transcript? Light background? Anything missing or broken? |        |
| A3  | Open the **PDF** dropdown (bottom left) → **Save as PDF**                                                    | Does the dropdown appear? What filename does it propose? (Expected: `Spike A - Fictional Weekly Sync`.) Save it and open it in Preview: is it legible?                                                                              |        |
| A4  | Run A1 again and click **Cancel**                                                                            | Is the Obsidian window title back to normal? Any red errors in the console?                                                                                                                                                         |        |
| A5  | In the console, run `document.querySelectorAll("iframe.selective-print-frame").length` after A3 and after A4 | Expected `0` both times (no leaked iframes).                                                                                                                                                                                        |        |
| A6  | Repeat A1-A3 with **Spike print test: sample note without iframe sandbox**                                   | Any difference from the sandboxed run?                                                                                                                                                                                              |        |
| A7  | Switch to a dark theme (Settings → Appearance) and repeat A1                                                 | Is the preview still black on white?                                                                                                                                                                                                |        |
| B1  | Cmd-P → **Show diagnostics** → **Copy to clipboard**                                                         | Paste the whole output into your report. Key lines: `remote:`, `remote.BrowserWindow:`, `webContents.printToPDF:`, `printToPDF probe:`.                                                                                             |        |
| B2  | Console                                                                                                      | Any errors while running B1? Copy them.                                                                                                                                                                                             |        |
| C1  | Settings → Community plugins: disable, then re-enable Selective Print                                        | Any errors? Do the commands still appear exactly once?                                                                                                                                                                              |        |

## Also needed at Gate A

- **Anonymized samples** (replace names, companies and content with fiction, but keep every
  heading exactly as generated): one generated meeting note including a Krisp transcript, one
  weekly review, and one meeting tracker. These replace the README-based guesses in the
  fixtures and starters.
- **Approval of the core semantics** listed in `STATUS.md` → "Waiting on Brian".

## Decision rules after results

- **If A1 or A3 fails in both variants:** I propose an alternative print path, such as a
  temporary full-window print stylesheet or a separate window, and wait for approval.
- **If B1 shows `remote: UNAVAILABLE` or the probe fails:** I propose how M4 changes, such as
  PDF only through the print dialog's "Save as PDF", or another route, and wait for approval.

## Observations

_To be filled from Brian's report._
