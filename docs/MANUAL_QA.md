# Manual QA (macOS)

Claude Code cannot run Obsidian or a printer. An item counts as verified only when Brian
reports it, with versions, in `docs/VALIDATION.md`. Brian tests by using the plugin; anything
he does not explicitly confirm is listed as **unverified** in the release notes.

**Setup:** install the release with BRAT and enable Selective Print. Use a test note with a
`## Transcript` heading, plus some other sections, a table, a callout, a code block, a task
list and an image.

## Quick try-list (Gate E, 0.4.0 → 1.0.0)

Use the plugin for a few real notes, then answer in plain words:

1. Print a meeting note: is Transcript left out by default, and does the printout look right?
2. Save a PDF: does the Save panel open on the Desktop and is the PDF good?
3. Settings → **Copy diagnostics**, then paste it anywhere: does it contain anything from your
   notes? (It should not.)
4. Turn the plugin off and on again (Settings → Community plugins): still one printer icon per
   note, and no error notices?
5. Anything you would change before calling it 1.0?

## Quick try-list (0.5.0: header and footer)

1. Print a note: does each page show the folder and note name and "Last modified …" at the top,
   and "Printed …" and "Page X of Y" at the bottom? If the print panel shows none of them, say
   so (that is the Chromium page-margin feature being unavailable).
2. Save a PDF: same check.
3. Settings → turn **Header and footer** off: the next printout has neither.

## Quick try-list (0.6.0: packs)

1. Right-click a meetings folder → **Print folder…**. Is the note list right and in date
   order? Set a date range for one week. Save as PDF.
2. In the PDF: cover page, contents (click a title: does it jump?), each note on its own page
   with its title, location and last-modified time, Transcript left out, and a header and
   footer with page numbers across the whole pack?
3. Select three notes with Cmd-click → right-click → **Print selected notes…** → Print.
4. Cmd-P → **Print notes by tag or property…** → `type: meeting`.

## Full checklist

| #   | Steps                                                                                                                                                                              | Expected                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | (a) Click the printer icon in the note header. (b) Cmd-P → **Print / export current note…** (c) Right-click the note in the file explorer → **Print / export…**                    | Each opens the review dialog. **Print** opens the macOS print panel.                                                                                                                                                                                                            |
| 2   | In the print panel: **PDF** → **Save as PDF**.                                                                                                                                     | The proposed file name is the note title. The PDF opens in Preview.                                                                                                                                                                                                             |
| 3   | (a) Open the dialog on a note with `## Transcript`. (b) Check Transcript and print. (c) Settings → Global exclude list: add `Agenda`, reopen the dialog. (d) **Reset to default**. | (a) Transcript unchecked, tagged "global"; everything else checked. (b) The transcript is in the output. (c) Agenda now unchecked. (d) The list is back to `Transcript`.                                                                                                        |
| 4   | Print four times: **Select all**; one section unchecked; a parent with subheadings unchecked; only one section checked.                                                            | Each printout matches the checklist exactly. Unchecking a parent drops its subheadings.                                                                                                                                                                                         |
| 5   | Print a note with a callout, a table, task checkboxes, a code block, an image and wikilinks, with a dark theme active.                                                             | Everything is legible; black on white (Neutral style).                                                                                                                                                                                                                          |
| 6   | Print a long note (several pages) with tables and callouts.                                                                                                                        | No heading alone at the bottom of a page; tables and callouts not split awkwardly.                                                                                                                                                                                              |
| 7   | With Dataview or Bases installed: print a note with a query block.                                                                                                                 | Results appear, or a notice says some content was still loading.                                                                                                                                                                                                                |
| 8   | Open the dialog and press **Cancel** (and Esc). Print, then cancel in the macOS panel.                                                                                             | No files, no changes to the note; printing again works straight away.                                                                                                                                                                                                           |
| 9   | **Save current note as PDF** with each **Save PDF files to** option: Ask, Desktop, The vault (with and without a PDF folder). Save twice.                                          | Ask: Save panel on the Desktop with `{date} - {title}.pdf`. Desktop and vault: the file goes there; the second save adds ` (2)`. Images are present.                                                                                                                            |
| 10  | When one-click PDF is unavailable or fails (rare on current Obsidian).                                                                                                             | A notice explains why and the print panel opens. Nothing fails silently. Also covered by automated tests with a fake bridge.                                                                                                                                                    |
| 11  | Disable and re-enable the plugin; reload Obsidian (Cmd-R).                                                                                                                         | One printer icon per note, no duplicates, no error notices.                                                                                                                                                                                                                     |
| 12  | Record Obsidian, macOS and plugin versions with each result in `docs/VALIDATION.md`.                                                                                               | Done by Claude from Brian's reports.                                                                                                                                                                                                                                            |
| 13  | Print and save a PDF of a multi-page note with **Header and footer** on, then off.                                                                                                 | On: header shows the location and last-modified time; footer shows the printed time and Page X of Y, on every page, in both outputs. Off: neither.                                                                                                                              |
| 14  | Print a folder pack and a selection pack, as Print and as PDF, with cover and contents on. Try a date range, subfolders, manual reordering and one preset for all.                 | The right notes in the chosen order; each starts on a new page with its title, location and last-modified time; default sections per note (Transcript out); contents links jump in the PDF; links between pack notes jump; pack header and footer with continuous page numbers. |
