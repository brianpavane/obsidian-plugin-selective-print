# User guide

Selective Print prints a note through the macOS print panel, or saves it as a PDF in one click.
You choose which sections to include each time. It works on Obsidian desktop for macOS.

## Printing a note

Use any of these:

- the **printer icon** at the top right of a note;
- the command **Selective Print: Print / export current note…**;
- right-click a note (in the file explorer or the editor) → **Print / export…**.

The review dialog opens. Adjust it if needed and click **Print**.

**Shift-click** the printer icon to skip the dialog and print with the defaults. The command
**Quick print current note (preset defaults)** does the same.

## The review dialog

- **Sections:** one checkbox per heading, indented by level. Content before the first heading
  appears as **(Preamble)**.
  - Unchecking a heading also unchecks its subheadings. You can re-check single subheadings
    afterwards; the parent then shows a dash (partly included).
  - Sections excluded by default are unchecked and tagged with where the exclusion comes from
    (**global** for the global exclude list). Nothing is ever hidden; check a section to
    include it this time.
  - **empty** marks sections that contain only placeholders (empty bullets or checkboxes,
    comments).
  - The number on the right is the section's size, so long transcripts stand out.
- **Select all / Select none / Reset / Invert:** quick changes. **Reset** returns to the defaults.
- **Include note title**, **Include properties** (None, All, or Choose… to pick properties) and
  **Skip empty sections**.
- **Preset:** presets that match this note come first, with the most specific selected.
  Then come your other presets, **Default** (global exclude list) and **Everything** (all
  sections). Switching presets resets the checklist to that preset's defaults. See
  [Presets](PRESETS.md).
- **Remember for this note:** saves the unchecked headings to the note's `print-exclude`
  property, so they are the defaults next time. **Save as new preset…** saves the current
  choices as a preset file.
- Keyboard: Tab moves between controls, Space toggles a checkbox, Enter prints, Esc cancels.

Your choices apply to this print only. The note changes only when you click **Remember for
this note**.

## Presets and per-note settings

Presets live as notes in the `Print Presets` folder; starters are installed on first run.
A note can force a preset with the `print-preset` property, or list its own exclusions in
`print-exclude`. See [Presets](PRESETS.md) for the format, matching rules and examples.

Commands: **Validate print presets**, **Open print preset…**, **Install / refresh starter
presets**.

## Saving a PDF

Run **Save current note as PDF**, or choose **PDF** in the dialog's **Output** menu. You can
also set **Default output** to PDF in settings so that the header icon saves PDFs.

Where the file goes depends on **Save PDF files to** in settings:

- **Ask where to save** (default): the macOS Save panel opens on your Desktop with the file
  name filled in. Pick any folder. The panel asks before replacing an existing file.
- **Desktop**: saved straight to the Desktop.
- **The vault**: saved into **PDF folder in the vault**, or next to the note when that is
  empty.

A preset with its own `pdf-folder` always saves into that vault folder. The file name comes
from the **PDF file name** template (default `{date} - {title}`). Desktop and vault saves never
overwrite; a second save adds ` (2)`. **Open PDF after saving** opens the new file in your PDF
app.

One-click PDF relies on a part of Electron that some Obsidian versions do not offer. When it is
unavailable, or anything goes wrong, a notice tells you why and the print dialog opens
instead. Choose **PDF → Save as PDF** there.

## Global exclude list

Settings → Selective Print → **Global exclude list**. These headings are excluded by default
from every note, at any heading level, ignoring case. It starts with `Transcript`. Add or
remove headings, or click **Reset to default**. Start an entry with `regex:` to use a regular
expression, for example `regex:^Appendix`.

## Inline exclusions

Wrap text in `%% print:exclude %%` and `%% /print:exclude %%` to leave it out of every
printout. The markers are Obsidian comments, so they are invisible in reading view.

## Settings reference

| Setting                            | Default                     | What it does                                                                  |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Always review before output        | On                          | Open the dialog on every print. Shift-click the icon to skip it once.         |
| Global exclude list                | `Transcript`                | Headings excluded by default in every note.                                   |
| Presets folder                     | `Print Presets`             | Where preset notes live.                                                      |
| Starter presets                    | Button                      | Install missing starters; update the ones you have not edited.                |
| Validate presets                   | Button                      | Report of preset problems.                                                    |
| Default output                     | Print                       | Print or PDF for the header icon; preselected in the dialog.                  |
| Save PDF files to                  | Ask where to save           | Save panel on the Desktop, the Desktop, or the vault.                         |
| PDF folder in the vault            | (next to the note)          | Only when saving into the vault.                                              |
| PDF file name                      | `{date} - {title}`          | Variables: `{title}` `{date}` `{datetime}` `{preset}` `{frontmatter.<key>}`.  |
| Open PDF after saving              | Off                         | Opens the new PDF in your PDF app.                                            |
| Skip empty sections                | On                          | Default for the dialog.                                                       |
| Paper size / orientation / margins | Letter / portrait / 0.75 in | Page setup for Print and PDF.                                                 |
| Print style                        | Neutral                     | Neutral prints black on white; Match theme (experimental) uses your theme.    |
| Show header icon / ribbon icon     | On / Off                    | Where the print button appears.                                               |
| Diagnostics                        | Button                      | Copies a report for bug reports, with no note content.                        |
| Debug logging                      | Off                         | Detailed `[SelectivePrint]` logs in the developer console, including timings. |

## Commands

Print / export current note… · Quick print current note (preset defaults) · Save current note
as PDF · Validate print presets · Open print preset… · Install / refresh starter presets ·
Show diagnostics. Assign hotkeys in Settings → Hotkeys.

## Limitations

- Headings inside embedded notes (`![[Other note]]`) are not filtered; embeds print as Obsidian
  renders them. Planned for 1.3.
- Content that loads slowly (Dataview, Bases, diagrams) gets up to 8 seconds. If it is still
  loading, a notice tells you some content may be missing.
- "Remember for this note" stores heading names, so it cannot keep a subheading whose parent is
  excluded, or tell apart two headings with the same name. A notice says when this happens.
- One-click PDF uses Electron's `remote` module. If a future Obsidian removes it, PDFs fall
  back to the print panel automatically.
