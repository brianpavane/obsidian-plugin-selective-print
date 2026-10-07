import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { splitFrontmatter } from "../src/core/sections";

const FIXTURES = join(import.meta.dirname, "fixtures");

export function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

/**
 * Parse a fixture's frontmatter the way the Obsidian layer will hand it to the core.
 * Obsidian's parseYaml is unavailable in tests; the `yaml` dev dependency stands in.
 */
export function fixtureFrontmatter(name: string): unknown {
  const { frontmatter } = splitFrontmatter(loadFixture(name));
  if (frontmatter === null) return null;
  const yamlText = frontmatter
    .replace(/^---[ \t]*\r?\n/, "")
    .replace(/(---|\.\.\.)[ \t]*\r?\n?$/, "");
  return parse(yamlText) as unknown;
}
