# Troubleshooting

## The print panel does not open

Check that a Markdown note is open and active. Try the command palette:
**Selective Print: Print / export current note…**. If an error notice appears, run
**Selective Print: Show diagnostics** and send the copied report.

## "One-click PDF is not available" or "PDF failed"

The plugin opened the print dialog instead: use **PDF → Save as PDF** there. One-click PDF
needs Electron's `remote` module, which some Obsidian versions do not provide. "Show
diagnostics" reports whether it is available. If the message mentions the PDF folder, check
Settings → **PDF folder in the vault**, or the preset's `pdf-folder` (it must be inside the
vault).

## The PDF did not go where I expected

Settings → **Save PDF files to** decides: the Save panel (default), the Desktop, or the vault.
A preset with its own `pdf-folder` always saves into that vault folder.

## A section is missing from the printout

- Was it unchecked in the dialog? Excluded sections are tagged "global", "preset" or "note".
- Does the note have a `print-exclude` property (from **Remember for this note**)? It replaces
  the preset and global lists. Delete the property to go back to the defaults.
- **Skip empty sections** drops sections that contain only placeholders.
- `%% print:exclude %%` blocks are always removed.

## Content is missing or blank (Dataview, Bases, diagrams, math)

Slow content gets 8 seconds. If a notice says content was still loading, try again once the
note has finished rendering in Obsidian. Math may lose formatting with the Neutral print style.

## The output is blank

Check that not every section is unchecked (the Print button is disabled when there is nothing
to print). If the note relies on Dataview or similar, see the section above. Otherwise copy the
diagnostics and report the problem.

## A preset is not used

Run **Validate print presets**: the preset may have an error (it is then skipped), or its
`applies-to` rule may not match. The dialog's preset menu shows matching presets first; the
note's `print-preset` property always wins.

## "Match theme" output looks wrong

Match theme is experimental. Switch back to **Neutral** in settings.

## Getting diagnostics

Settings → Selective Print → **Copy diagnostics**, or run **Selective Print: Show diagnostics**.
The report lists versions, capabilities, presets and settings, with no note content. For more
detail, turn on **Debug logging** and open the developer console (Option-Cmd-I); lines start
with `[SelectivePrint]`.
