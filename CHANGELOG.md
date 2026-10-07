# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Tags equal the version with no `v` prefix.

## [Unreleased]

### Added

- M0: repository scaffold (strict TypeScript, esbuild, ESLint with the Obsidian ruleset,
  Prettier, Vitest, CI and release workflows), settings schema v1 with migration.
- M0: Spike A commands (print a fictional sample note from a hidden iframe, with and
  without an iframe sandbox) and Spike B "Show diagnostics" command (Electron capability
  detection and an in-memory `printToPDF` probe).
- M1: pure core engine: section parser, exclusion resolution, content filters, preset
  schema validation and matching, filename templates.
