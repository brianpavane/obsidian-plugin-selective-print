# Selective Print for Obsidian

Print notes and export them to PDF, choosing which sections to include each time. A note's
`Transcript` section is left out by default, and you can opt back in when you print.

> **Status: 0.2.0.** Print with section selection, plus presets stored as notes in your vault.
> Not yet confirmed on macOS for daily use (see the release notes). One-click PDF arrives in
> 0.3.0.

- **Platform:** Obsidian desktop on **macOS only**.
- **Privacy:** no network access, telemetry or accounts.
- **Distribution:** [BRAT](https://github.com/TfTHacker/obsidian42-brat) from this repository's
  GitHub releases.

## Install with BRAT

1. Install and enable the BRAT community plugin.
2. In BRAT, choose **Add beta plugin** and enter
   `https://github.com/brianpavane/obsidian-plugin-selective-print`.
3. Enable **Selective Print** in Settings → Community plugins.

## Quick start

1. Open a note and click the **printer icon** at the top right.
2. Review the section checklist. `Transcript` is unchecked by default; check it to include it.
3. Click **Print**. To make a PDF, choose **PDF → Save as PDF** in the macOS print panel.

Shift-click the icon to print with the defaults and skip the dialog. Edit the default exclusions
in Settings → Selective Print → Global exclude list. Presets in the `Print Presets` folder set
defaults per kind of note; see [Presets](docs/PRESETS.md).

## Supported outputs

| Output                                             | Version |
| -------------------------------------------------- | ------- |
| Print (macOS print panel, including "Save as PDF") | 0.1.0   |
| One-click PDF                                      | 0.3.0   |
| Self-contained HTML, filtered Markdown             | 1.1     |

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Presets](docs/PRESETS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md) for contributors

## License

[MIT](LICENSE)
