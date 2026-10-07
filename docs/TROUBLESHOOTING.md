# Troubleshooting

## The print panel does not open

Check that a Markdown note is open and active. Try the command palette:
**Selective Print: Print / export current note…**. If an error notice appears, run
**Selective Print: Show diagnostics** and send the copied report.

## "One-click PDF is not available" or "PDF failed"

The plugin opened the print dialog instead: use **PDF → Save as PDF** there. One-click PDF
needs Electron's `remote` module, which some Obsidian versions do not provide. "Show
diagnostics" reports whether it is available. If the message mentions the PDF folder, check
Settings → PDF folder (it must be inside the vault).

## A section is missing from the printout

- Was it unchecked in the dialog? Excluded sections are tagged "global".
- **Skip empty sections** drops sections that contain only placeholders.
- `%% print:exclude %%` blocks are always removed.

## Content is missing or blank (Dataview, Bases, diagrams, math)

Slow content gets 8 seconds. If a notice says content was still loading, try again once the
note has finished rendering in Obsidian. Math may lose formatting with the Neutral print style.

## "Match theme" output looks wrong

Match theme is experimental. Switch back to **Neutral** in settings.

## Getting diagnostics

Run **Selective Print: Show diagnostics** and click **Copy to clipboard**. The report contains
no note content.
