---
selective-print-preset: true
preset-version: 1
starter-version: 3
name: Meeting notes
description: Meeting notes without properties, the transcript (global exclude list) or empty sections.
applies-to:
  - property: type
    equals: meeting
sections:
  inherit-global: true
  exclude: []
  skip-empty: true
properties:
  mode: none # the note's properties are not printed; switch on in the dialog
---
<!-- verified against live notes by Brian, 2026-10-07 -->

Starter preset installed by Selective Print. It applies to notes whose `type` property is
`meeting`. The transcript is excluded through the global exclude list (Settings → Selective
Print).

Properties are not printed. To print them once, set **Include properties** in the print
dialog to All or Choose…; to print them every time, change `mode: none` to `mode: all`.

Edit this file freely. Once you change it, plugin upgrades leave it alone.
