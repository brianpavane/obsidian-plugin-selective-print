# Presets

_Stub. The full schema reference ships with M3 (0.2.0). The schema below is the M1
validation target; it becomes frozen at Gate C._

- Preset files are Markdown notes in the presets folder (default `Print Presets/`) whose
  frontmatter has `selective-print-preset: true` and `preset-version: 1`.
- Exclusion precedence (highest first): dialog selection → note `print-exclude` (replaces
  everything below) → preset `sections.exclude` (unioned with the global list unless
  `inherit-global: false`) → global exclude list → include everything.
- Matching specificity: property > tag > folder > filename. A note's `print-preset` always wins.

See `SPEC.md` section 3.3 for the complete v1 schema.
