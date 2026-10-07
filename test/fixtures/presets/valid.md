---
selective-print-preset: true
preset-version: 1
name: Meeting recap
description: Summary, decisions and action items only
applies-to:
  - property: type
    equals: meeting
  - tag: customer-call
    folder: "Projects/Active"
  - filename-matches: "* - weekly review"
sections:
  inherit-global: true
  exclude: [Agenda, Notes, "regex:^Appendix"]
  skip-empty: true
include-title: true
properties:
  mode: except
  list: [attendees]
callouts:
  exclude-types: [private]
inline-markers: true
output:
  format: print
  pdf-folder: "Exports"
  filename: "{date} - {title}"
  paper: letter
  orientation: portrait
  footer: ""
---
Free-text notes about this preset. Ignored by the engine.
