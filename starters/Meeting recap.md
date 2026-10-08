---
selective-print-preset: true
preset-version: 1
starter-version: 3
name: Meeting recap
description: Summary, next steps, decisions and additional items only. Pick it from the preset menu.
sections:
  inherit-global: true
  exclude:
    - 'regex:^(agenda|notes|summary by topic|summary \(by topic\)|speakers)$'
  skip-empty: true
properties:
  mode: all
---
<!-- verified against the Meeting Notes plugin's note layout (6.20.1), 2026-10-08; v2 verified against live notes by Brian, 2026-10-07 -->

Starter preset installed by Selective Print. It works with both meeting note layouts:

- Kept: Executive Summary (or Meeting Summary), Next Steps (or Action items), Key Decisions
  (or Decisions) and Additional Items.
- Left out: Agenda, Notes, Summary by Topic, Speakers, and the transcript (through the global
  exclude list).

The left-out headings are one `regex:` entry so that a note with only some of them (an older
note has no Summary by Topic or Speakers) shows no "not found" warning.

It has no `applies-to` rule on purpose: choose it from the preset menu in the print dialog.
"Meeting notes" stays the automatic default for meetings.
