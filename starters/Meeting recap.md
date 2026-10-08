---
selective-print-preset: true
preset-version: 1
starter-version: 2
name: Meeting recap
description: Summary, decisions and action items only. Pick it from the preset menu.
sections:
  inherit-global: true
  exclude: [Agenda, Notes]
  skip-empty: true
properties:
  mode: all
---
<!-- verified against live notes by Brian, 2026-10-07 -->

Starter preset installed by Selective Print. It leaves out Agenda and Notes (and the
transcript, through the global exclude list), keeping Meeting Summary, Decisions and Action
items.

It has no `applies-to` rule on purpose: choose it from the preset menu in the print dialog.
"Meeting notes" stays the automatic default for meetings.
