# User guide

Selective Print prints a note through the macOS print panel, or saves it straight to a PDF
file in your vault. You choose which sections to include each time.

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

- The file goes next to the note, or into the **PDF folder** from settings or the preset.
- It is named by the **PDF file name** template (default `{date} - {title}`).
- Existing files are never overwritten: a second save adds ` (2)`.
- **Open PDF after saving** opens the new file in your PDF app.

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

## Print settings

Paper size, orientation, margins and print style. **Neutral** always prints black on white;
**Match theme** (experimental) uses your current theme.

## Limitations

- Headings inside embedded notes (`![[Other note]]`) are not filtered; embeds print as Obsidian
  renders them. Planned for 1.3.
- Content that loads slowly (Dataview, Bases, diagrams) gets up to 8 seconds. If it is still
  loading, a notice tells you some content may be missing.
