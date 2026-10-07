# Backlog

Items here are **not** scheduled. Nothing is built until it is moved into a milestone, and
post-1.0 work needs a Gate F scope approval (`CLAUDE.md` section 4).

## Deferred by the spec

- Include lists and an include-only mode: a global toggle and a `print-include` note key,
  with a guard against empty output.
- PDF outline and bookmarks. Check the bundled Electron version first.
- DOCX via Pandoc. Needs an external binary.
- Per-preset headers and footers with page numbers, beyond the basic footer text in 1.1.

## Scheduled post-1.0 (listed for reference)

- M6 (1.1): HTML and Markdown adapters, safe-to-share mode, URI handler, footer text.
- M7 (1.2): sidebar panel with live preview.
- M8 (1.3): multi-note packs, heading filtering inside embeds.

## New ideas

- Adopt the declarative settings API (Obsidian 1.13+) so settings appear in settings search.
  Needs `minAppVersion` 1.13 or a fallback.
- "Forget remembered choices" button in the dialog (today: delete the `print-exclude` property).
- Preset tie-break priority (for example a `priority:` key) so several presets can match
  `type: meeting` without the alphabetical first one becoming the default. Schema change;
  needs a gate.
- Optional "Copy as filename" setting: propose `{date} - {title}` instead of the note title in
  the print panel's PDF dropdown.
