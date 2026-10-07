# Selective Print for Obsidian

Print notes or save them as PDF, choosing which sections to include each time. A note's
`Transcript` section is left out by default, and you can opt back in when you print.

> **Status: 0.4.0, release candidate for 1.0.** See the release notes for what has been
> confirmed on macOS and what is still unverified.

- **Platform:** Obsidian desktop on **macOS only**. On other platforms the plugin shows a notice
  and stays inactive.
- **Privacy:** no network access, telemetry or accounts. The plugin only reads your notes; it
  changes a note only when you click **Remember for this note**.
- **Distribution:** [BRAT](https://github.com/TfTHacker/obsidian42-brat) from this repository's
  GitHub releases. Not in the community plugin directory.

<!-- Screenshots: review dialog, settings, a printed page. To be added. -->

## Install in a fresh vault (BRAT)

1. Settings → **Community plugins** → turn off **Restricted mode** if it is on.
2. **Browse** → search for **BRAT** → **Install** → **Enable**.
3. Command palette (Cmd-P) → **BRAT: Add a beta plugin for testing** → paste
   `https://github.com/brianpavane/obsidian-plugin-selective-print` → choose the latest
   version → **Add plugin**.
4. Settings → **Community plugins** → enable **Selective Print**.
5. A `Print Presets` folder with five starter presets appears in the vault. A printer icon
   appears at the top right of every note.

To update later: Cmd-P → **BRAT: Check for updates to all beta plugins**.

## 60-second quick start

1. Open a note and click the **printer icon** at the top right.
2. The dialog lists the note's sections. `Transcript` is unchecked; check it to include it.
   Uncheck anything else you want to leave out.
3. Click **Print** for the macOS print panel, or choose **PDF** under **Output** and click
   **Save PDF**. The Save panel opens on the Desktop.

Shift-click the icon to skip the dialog and use the defaults. Change the defaults in
Settings → Selective Print (global exclude list, PDF destination, paper, and more), or per kind
of note with [presets](docs/PRESETS.md).

## Supported outputs

| Output                                                                                      | Since           |
| ------------------------------------------------------------------------------------------- | --------------- |
| Print (macOS print panel, including its "Save as PDF")                                      | 0.1.0           |
| One-click PDF: Save panel, Desktop or vault; falls back to the print panel when unavailable | 0.3.0           |
| Self-contained HTML, filtered Markdown                                                      | planned for 1.1 |

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Presets](docs/PRESETS.md): schema, matching, per-note overrides, starters, examples
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- Contributors: [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md),
  [Validation status](docs/VALIDATION.md), [Manual QA](docs/MANUAL_QA.md),
  [Release process](RELEASE_PROCESS.md)

## License

[MIT](LICENSE)
