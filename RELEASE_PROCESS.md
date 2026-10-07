# Release process

Manual, small and boring. See also `CLAUDE.md` section 8.

1. Confirm the gate for this version is closed, or that the pass-end summary has been posted.
2. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version and date.
3. Run the full check suite: `npm run lint && npm run typecheck && npm test && npm run build`.
4. Bump versions together: `npm version <x.y.z> --no-git-tag-version`. This runs
   `version-bump.mjs`, which updates `manifest.json` and `versions.json`.
5. Commit: `release: <x.y.z>`.
6. Tag with the exact version, no `v` prefix: `git tag <x.y.z>`, then
   `git push && git push --tags`.
7. The release workflow builds and creates a **draft** GitHub release with `main.js`,
   `manifest.json` and `styles.css`. BRAT cannot see drafts. Edit the notes to list every
   **unverified** manual QA item (see `docs/VALIDATION.md`), then publish:
   `gh release edit <x.y.z> --draft=false --latest --notes-file <notes.md>`.
   Internal or test builds are published with `--prerelease` instead of `--latest`.
8. Check the BRAT install steps in `README.md` against the published release.
