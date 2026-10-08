# Presets

A preset is a named set of print defaults: which sections to leave out, whether to print the
title and properties, and so on. A preset can apply itself automatically to a kind of note.

Presets are ordinary Markdown notes in the **presets folder** (default `Print Presets/`, set
in Settings → Selective Print). They sync with your vault and you edit them in Obsidian.
Changes take effect immediately; no restart is needed. The text below the frontmatter is for
your own notes and is ignored.

## Schema (`preset-version: 1`)

```yaml
---
selective-print-preset: true # required marker
preset-version: 1 # required
name: Meeting recap # required, unique (case-insensitive)
description: Summary, decisions and action items only
applies-to: # optional; see "Matching"
  - property: type
    equals: meeting
sections:
  inherit-global: true # true: add to the global exclude list; false: replace it
  exclude: [Agenda, Notes] # heading names; "regex:^Appendix" also allowed
  skip-empty: true # omit to use the setting
include-title: true
properties:
  mode: all # none | all | except
  list: [] # property names hidden by "except"
callouts:
  exclude-types: [] # e.g. [private]
inline-markers: true # honor %% print:exclude %% blocks
output:
  paper: letter # letter | a4; omit to use the setting
  orientation: portrait # portrait | landscape; omit to use the setting
  format: pdf # print | pdf; omit to use the setting
  pdf-folder: Exports # vault folder for one-click PDFs; overrides "Save PDF files to"
  filename: "{date} - {title}" # PDF file name template; omit to use the setting
  # footer is accepted now and used from 1.1
---
```

| Key                                  | Type                  | Default  | Notes                                                                       |
| ------------------------------------ | --------------------- | -------- | --------------------------------------------------------------------------- |
| `selective-print-preset`             | `true`                | required | Files without this key are ignored.                                         |
| `preset-version`                     | `1`                   | required | Other versions are rejected with a message.                                 |
| `name`                               | text                  | required | Shown in the dialog's preset menu. `Default` and `Everything` are reserved. |
| `description`                        | text                  | ""       |                                                                             |
| `starter-version`                    | whole number          | none     | Set on bundled starters; used for upgrades.                                 |
| `applies-to`                         | list of matchers      | `[]`     | No matchers: the preset is only used when picked by hand.                   |
| `sections.inherit-global`            | true/false            | `true`   |                                                                             |
| `sections.exclude`                   | list of text          | `[]`     | Case-insensitive, trimmed, any heading level; subheadings go along.         |
| `sections.skip-empty`                | true/false            | setting  |                                                                             |
| `include-title`                      | true/false            | `true`   |                                                                             |
| `properties.mode`                    | `none`/`all`/`except` | `all`    |                                                                             |
| `properties.list`                    | list of text          | `[]`     | Used with `except`.                                                         |
| `callouts.exclude-types`             | list of text          | `[]`     | Case-insensitive callout types; nested content goes along.                  |
| `inline-markers`                     | true/false            | `true`   |                                                                             |
| `output.paper`, `output.orientation` | see above             | settings |                                                                             |

**Validation:** every preset is checked when it loads and whenever it changes.

- **Errors** (missing required keys, wrong types, invalid regex, unknown matcher keys, duplicate
  names, unreadable YAML) make the plugin skip that preset.
- **Warnings** (unknown keys elsewhere) do not.

Run **Selective Print: Validate print presets** for the full report: file, field and what was
expected. Settings shows the counts.

## Which sections are excluded (precedence)

Highest first:

1. **Your choices in the dialog.**
2. **The note's `print-exclude` property.** When present, it **replaces** everything below. An
   empty list means "include everything".
3. **The preset's `sections.exclude`**, added to the global exclude list unless
   `inherit-global: false`.
4. **The global exclude list** (settings; starts with `Transcript`).
5. Otherwise everything is included.

There are no "include only" lists. To print a normally excluded section, check it in the
dialog, or use a preset with `inherit-global: false`.

## Matching

`applies-to` is a list. A preset applies when **any** entry matches. Within one entry,
**all** conditions must match.

| Condition                              | Matches when                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `property: <name>` + `equals: <value>` | The note's property equals the value (as text, case-insensitive). For a list property, any item may match. |
| `tag: <tag>`                           | The note has the tag, or a nested tag below it (`customer` matches `customer/contoso`).                    |
| `folder: <path>`                       | The note is in that folder or a subfolder.                                                                 |
| `filename-matches: <glob>`             | The file name (without `.md`) matches; `*` is any text, `?` one character; case-insensitive.               |

**Several matches:**

- Every matching preset is listed at the top of the dialog's preset menu. The most specific
  one is selected, ranked property > tag > folder > filename; an entry with more conditions
  wins a tie, then names sort alphabetically.
- A note's `print-preset: <name>` property always wins.
- With no match, the built-in **Default** is used (the global exclude list applies).

**Drift warnings:** when a preset names a heading the note does not have, the dialog shows
"not found: <heading>" and carries on. This is how you notice when a template changes.

## Per-note overrides

| Property        | Meaning                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `print-preset`  | Use this preset for the note (by name).                                                        |
| `print-exclude` | The complete list of headings to exclude for this note. Replaces preset and global exclusions. |

**Remember for this note** in the dialog writes the unchecked headings to `print-exclude`.
This is the only time the plugin changes a note, and it only touches that property. Some
selections cannot be stored exactly as names; the plugin tells you when that happens. For
example, a subheading kept under an excluded parent will be excluded next time. To forget,
delete the `print-exclude` property.

## Creating a preset from the dialog

**Save as new preset…** in the dialog writes a new file to the presets folder with the
current choices:

- The unchecked headings become a complete `exclude` list, with `inherit-global: false`.
- The new preset has no `applies-to` rule. Add one to make it automatic.
- Existing files are never overwritten.

## Starter presets

On first run the plugin copies these starters into the presets folder. The three meeting
starters were checked against real meeting notes (2026-10-07). On 2026-10-08 Meeting recap and
Weekly review were updated for the Meeting Notes plugin's 6.20 layout (checked against its
source, not yet against your notes). The tracker starter is minimal and only checked against
that plugin's README.

Meeting notes come in two layouts, and every meeting starter handles both:

| Older notes     | Newer notes (six-section write-up)           |
| --------------- | -------------------------------------------- |
| Meeting Summary | Executive Summary                            |
| Action items    | Next Steps                                   |
| Decisions       | Key Decisions                                |
| (none)          | Summary by Topic, Additional Items, Speakers |

Agenda, Notes and Transcript are in both. An older note that got an AI reply later can have
some of each.

| Starter                        | Applies to                   | Leaves out                                                            |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------------- |
| Meeting notes                  | `type: meeting`              | Transcript (global list), empty sections                              |
| Meeting recap                  | (pick it by hand)            | Transcript, Agenda, Notes, Summary by Topic, Speakers, empty sections |
| Meeting full (with transcript) | (pick it by hand)            | nothing (`inherit-global: false`)                                     |
| Meeting tracker                | file name `Meeting Tracker*` | Transcript (global list)                                              |
| Weekly review                  | `type: weekly-review`        | Transcript (global list)                                              |

**Upgrades:** a plugin update adds new starters and updates starters you have not edited.

- Edited starters are never touched.
- **Install / refresh starter presets** (command or settings) also re-creates starters you
  deleted. For an edited starter, it writes the new version next to it as
  `<name> (new starter).md`.

## Worked examples

**Meeting with a client: no transcript, no attendee list**

```yaml
---
selective-print-preset: true
preset-version: 1
name: Client meeting
applies-to:
  - property: type
    equals: meeting
    tag: client
properties:
  mode: except
  list: [attendees]
---
```

**Weekly review: skip the private reflections**

```yaml
---
selective-print-preset: true
preset-version: 1
name: Weekly review (shareable)
applies-to:
  - property: type
    equals: weekly-review
sections:
  exclude: [Reflections, "regex:^Private"]
callouts:
  exclude-types: [private]
---
```

**Project note: everything, including normally excluded sections**

```yaml
---
selective-print-preset: true
preset-version: 1
name: Project full
applies-to:
  - folder: Projects
sections:
  inherit-global: false
---
```

**Generic: any note, title only, no properties**

```yaml
---
selective-print-preset: true
preset-version: 1
name: Clean
properties:
  mode: none
---
```
