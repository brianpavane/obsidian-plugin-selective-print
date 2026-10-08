---
selective-print-preset: true
preset-version: 1
starter-version: 2
name: Meeting notes
description: Meeting notes without the transcript (global exclude list) and without empty sections.
applies-to:
  - property: type
    equals: meeting
sections:
  inherit-global: true
  exclude: []
  skip-empty: true
properties:
  mode: all
---
<!-- verified against live notes by Brian, 2026-10-07 -->

Starter preset installed by Selective Print. It applies to notes whose `type` property is
`meeting`. The transcript is excluded through the global exclude list (Settings → Selective
Print).

Edit this file freely. Once you change it, plugin upgrades leave it alone.
