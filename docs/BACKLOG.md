# Backlog

Items here are **not** scheduled. Nothing is built until it is moved into a milestone, and
post-1.0 work needs a Gate F scope approval (`CLAUDE.md` section 4).

## Deferred by the spec

- Include lists and an include-only mode: a global toggle and a `print-include` note key,
  with a guard against empty output. Digest packs (0.7.0) cover the multi-note case; single
  notes stay exclude-only.
- PDF outline and bookmarks. Check the bundled Electron version first.
- DOCX via Pandoc. Needs an external binary.
- Custom header and footer text or templates, and per-preset header settings (0.5.0 ships a fixed layout with an on/off setting; a preset key needs a schema migration and a gate).

## Scheduled post-1.0 (listed for reference)

- M6 (1.1): HTML and Markdown adapters, safe-to-share mode, URI handler, footer text.
- M7 (1.2): sidebar panel with live preview.
- M8 (1.3): multi-note packs, heading filtering inside embeds.

## New ideas

- Packs: page numbers in the contents. Chromium cannot compute them (no `target-counter()`);
  it would need a second pass over the generated PDF.
- Packs: a running header with each note's own name (Chromium lacks `string-set` and running
  elements); today each note's details print under its title.
- Packs: remember the last pack options.

- Adopt the declarative settings API (Obsidian 1.13+) so settings appear in settings search.
  Needs `minAppVersion` 1.13 or a fallback.
- "Forget remembered choices" button in the dialog (today: delete the `print-exclude` property).
- Preset tie-break priority (for example a `priority:` key) so several presets can match
  `type: meeting` without the alphabetical first one becoming the default. Schema change;
  needs a gate.
- Save panel: start in the last folder used instead of the Desktop.
- Starter presets for the Meeting Notes plugin's series notes (`type: meeting-series`), account
  overviews (`type: meeting-account`) and Meeting Insights. Not needed today: they print fine
  with the default rules (Brian, 2026-10-08).
- Optional "Copy as filename" setting: propose `{date} - {title}` instead of the note title in
  the print panel's PDF dropdown.
