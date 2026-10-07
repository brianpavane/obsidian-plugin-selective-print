# Selective Print for Obsidian

Print notes and export them to PDF, choosing which sections to include each time. A note's
`Transcript` section is left out by default, and you can opt back in when you print.

> **Status: pre-release (Pass 1: scaffold, feasibility spikes and core engine).** No features
> for daily use yet. The first BRAT build is planned for 0.1.0.

- **Platform:** Obsidian desktop on **macOS only**.
- **Privacy:** no network access, telemetry or accounts.
- **Distribution:** [BRAT](https://github.com/TfTHacker/obsidian42-brat) from this repository's
  GitHub releases.

## Install with BRAT (from 0.1.0)

1. Install and enable the BRAT community plugin.
2. In BRAT, choose **Add beta plugin** and enter
   `https://github.com/brianpavane/obsidian-plugin-selective-print`.
3. Enable **Selective Print** in Settings → Community plugins.

## Quick start

Placeholder until 0.1.0: open a note, click the print icon in the note header, review the
section checklist (Transcript is unchecked), and click **Print**.

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
