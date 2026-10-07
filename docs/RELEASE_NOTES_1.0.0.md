# Selective Print 1.0.0: release notes (draft)

Print Obsidian notes, or save them as PDF, choosing which sections to include each time.
macOS desktop only. Install with BRAT; see the README.

## Highlights

- **Review dialog** on every print: the section checklist. `Transcript` is unchecked by
  default and can be opted back in. Quick actions, title and properties options, and skip
  empty sections.
- **Print** through the macOS print panel, or **one-click PDF**: the Save panel opens on the
  Desktop, or the file goes straight to the Desktop or the vault. It falls back to the print
  panel when one-click PDF is unavailable.
- **Global exclude list** (starts with `Transcript`), **presets** stored as notes and matched by
  property, tag, folder or filename, per-note overrides (`print-preset`, `print-exclude`),
  **Remember for this note**, **Save as new preset…**, and five starter presets.
- Built-in validation: a preset report, drift warnings ("not found: X") and diagnostics
  without note content.
- No network access, telemetry or accounts. Notes change only when you click **Remember for
  this note**.

## Confirmed on macOS (Obsidian 1.14.4, macOS 26.7)

- Printing through the macOS print panel; skip empty sections.
- One-click PDF: output quality; the Save panel opens on the Desktop.
- Presets and starters: reported OK in general at Gate C (not item by item).

## Unverified on macOS

These are covered by automated tests where possible, but have not been confirmed on a Mac:

- Transcript unchecked by default in the dialog, and the global list editing flow (QA item 3).
- Output matching every selection pattern; parent and child toggles (QA item 4).
- Rendering of callouts, tables, images and code; dark theme printing light; page breaks
  (QA items 5-6).
- Async content (Dataview, Bases) and the settle notice (QA item 7).
- Cancel leaving no residue (QA item 8).
- PDF Desktop and vault destinations, ` (2)` naming, open after saving (QA item 9).
- The PDF fallback to the print panel (QA item 10; one-click PDF works on 1.14.4, so it was
  not triggered).
- Reload and disable/enable without duplicate icons (QA item 11).
- Starter heading names against real generated notes.
- "Match theme" print style (experimental).

_Update this list from Brian's Gate E report before publishing._
