# Manual QA (macOS)

_Stub. Items 1-8 are written with exact steps at the end of M2 (Gate B); items 9-10 at M4._

Claude Code cannot run Obsidian or a printer. An item is only "verified" when Brian reports
it, with versions, in `docs/VALIDATION.md`.

Item list (from `SPEC.md` section 7.3):

1. Print dialog opens from the header icon and from the command palette.
2. The macOS PDF dropdown ("Save as PDF") works and proposes the note title as filename.
3. Dialog defaults: Transcript unchecked; checking it includes it; editing the global list
   changes the next dialog.
4. Output matches selection exactly (none excluded, one, parent with children, all but one).
5. Callouts, tables, tasks, code blocks, images and wikilinks render legibly; dark theme
   prints light.
6. Page breaks: no orphaned headings; tables and callouts not split awkwardly.
7. Async blocks appear in output, or a visible warning is shown.
8. Cancel leaves no files, temp elements or console errors.
9. PDF adapter: right folder, right name, `%PDF-` header, opens in Preview.
10. PDF fallback: with `remote` unavailable, a notice appears and Print is used.
11. Reload and disable/enable: no duplicate header icons, no leaked iframes.
12. Record Obsidian, macOS and plugin versions and the result per item in `VALIDATION.md`.
