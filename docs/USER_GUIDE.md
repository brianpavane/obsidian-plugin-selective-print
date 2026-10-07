# User guide

Selective Print prints a note through the macOS print panel. You choose which sections to
include each time. Use **PDF → Save as PDF** in the print panel to make a PDF. One-click PDF
arrives in 0.3.0.

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
- **Preset:** **Default** applies the global exclude list. **Everything** includes all sections.
  Presets you define arrive in 0.2.0.
- Keyboard: Tab moves between controls, Space toggles a checkbox, Enter prints, Esc cancels.

Your choices apply to this print only; nothing is saved to the note.

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
