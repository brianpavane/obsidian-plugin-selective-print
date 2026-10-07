# Manual QA (macOS)

Claude Code cannot run Obsidian or a printer. An item counts as verified only when Brian
reports it, with versions, in `docs/VALIDATION.md`. Brian tests by using the plugin; anything he
does not explicitly confirm is listed as **unverified** in the release notes.

**Setup:** install the release with BRAT and enable Selective Print. Use a test note with a
`## Transcript` heading, plus some other sections, a table, a callout, a code block, a task
list and an image.

## Quick try-list (Gate B)

1. Click the printer icon at the top right of a note. The dialog opens with Transcript
   unchecked and tagged "global". Click **Print**. The macOS print panel opens and the
   preview has no transcript.
2. In the print panel, open **PDF → Save as PDF**. The proposed name is the note's title.
3. Print again and check Transcript. The transcript is included this time.
4. Anything confusing, ugly or broken in the dialog or the printout? Tell me in plain words.

## Quick try-list (Gate C, 0.2.0)

1. After updating, check that a **Print Presets** folder appeared with five starter notes.
   Open "Meeting notes" and read it.
2. Open a real meeting note (with `type: meeting`) and click the printer icon. The preset
   menu shows **Meeting notes** selected, and Transcript is unchecked. Do the other headings
   in the starters (Agenda, Notes, Meeting Summary, Decisions, Action items) match your real
   notes? Any "not found" warnings?
3. Switch the preset to **Meeting recap**. Agenda and Notes become unchecked.
4. Uncheck something and click **Remember for this note**. The note gains a `print-exclude`
   property. Reopen the dialog: the same sections are unchecked, tagged "note".
5. Click **Save as new preset…**, give it a name, and check that a new file appears in Print
   Presets.
6. Try a weekly review and a meeting tracker note. Is the right starter selected?

## Quick try-list (Gate D, 0.3.0)

1. Open a note and run **Selective Print: Save current note as PDF** from the command palette.
   In the dialog the button says **Save PDF**; click it.
2. Either a notice says "Saved <folder>/<date> - <title>.pdf" and the file appears next to the
   note, or a notice explains that one-click PDF is not available and the print dialog opens
   instead. Tell me which one happened.
3. If it saved: open the PDF. Does it look like the printout (sections, title, images)?
4. Save the same note again. The second file gets " (2)", and nothing is overwritten.
5. Optional: Settings → **Open PDF after saving** on, then save again. Does it open in Preview?
   Do you want to keep this option?

## Full checklist (items 1-8, M2)

| #   | Steps                                                                                                                                                                                                           | Expected                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | (a) Click the printer icon in the note header. (b) Cmd-P → **Selective Print: Print / export current note…** (c) Right-click the note in the file explorer → **Print / export…**                                | Each opens the review dialog. **Print** opens the macOS print panel.                                                                                                                            |
| 2   | In the print panel: **PDF** dropdown → **Save as PDF**                                                                                                                                                          | The proposed filename is the note title. The saved PDF opens in Preview.                                                                                                                        |
| 3   | (a) Open the dialog on a note with `## Transcript`. (b) Check Transcript and print. (c) Settings → Selective Print → Global exclude list: add `Agenda`, then reopen the dialog. (d) Click **Reset to default**. | (a) Transcript is unchecked and tagged "global"; everything else is checked. (b) The transcript is in the output. (c) Agenda is now unchecked by default. (d) The list is back to `Transcript`. |
| 4   | Print four times: nothing excluded (**Select all**); one section unchecked; a parent with subheadings unchecked; only one section checked.                                                                      | Each printout matches the checklist exactly. Unchecking a parent drops its subheadings.                                                                                                         |
| 5   | Print a note with a callout, a table, task checkboxes, a code block, an image and wikilinks, with a **dark** theme active.                                                                                      | Everything is legible. The page is black on white (Neutral style).                                                                                                                              |
| 6   | Print a long note (several pages) with tables and callouts.                                                                                                                                                     | No heading sits alone at the bottom of a page. Tables and callouts are not split awkwardly.                                                                                                     |
| 7   | If Dataview or Bases is installed: print a note with a query block.                                                                                                                                             | The results appear, or a notice says some content was still loading.                                                                                                                            |
| 8   | Open the dialog and click **Cancel** (also try Esc). Then print and cancel in the macOS panel.                                                                                                                  | No files are created and nothing changes in the note. Printing again works straight away.                                                                                                       |

| #                                                    | Steps                                                                                                                                                                                                                                          | Expected                                                                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9                                                    | Run **Save current note as PDF** (or pick **PDF** in the dialog's Output menu) on a note with a table, a callout and an embedded image. Repeat with **PDF folder** set to `Exports`, and with a file name template using `{frontmatter.type}`. | The file is written to the right folder with the right name (next to the note by default, `{date} - {title}.pdf`). A second save adds ` (2)`. The PDF opens in Preview; images are present. |
| 10                                                   | If one-click PDF is unavailable on this Obsidian version, or fails:                                                                                                                                                                            | A notice explains why and the macOS print dialog opens instead ("use PDF → Save as PDF"). Nothing fails silently. (The fallback is also covered by automated tests with a fake bridge.)     |
| Item 11 (reload without duplicate icons) and item 12 |
| (recording versions) apply to every release.         |
