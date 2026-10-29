import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join, relative, resolve, sep } from "path";
import { fileURLToPath } from "url";

// A platform is a domain module in src/<platform>/ and its tools in
// src/cli/tools/<platform>/. Deleting both folders and the one registry
// import removes it, so nothing else may reach into either.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(SRC, "cli");
const TOOLS = join(CLI, "tools");
const REGISTRY = join(CLI, "registry.ts");
const INDEX = "index.ts";
const SOURCE_EXTENSION = ".ts";
/** A relative specifier in `import … from "…"` or `export … from "…"`. */
const RELATIVE_IMPORT = /\bfrom\s+"(\.{1,2}\/[^"]+)"/g;

interface Import {
  file: string;
  target: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.name.endsWith(SOURCE_EXTENSION)) return [path];
    return [];
  });
}

function importsOf(file: string): Import[] {
  const text = readFileSync(file, "utf-8");
  return [...text.matchAll(RELATIVE_IMPORT)].map((match) => ({
    file,
    target: resolve(dirname(file), match[1]),
  }));
}

function isInside(path: string, dir: string): boolean {
  return path.startsWith(`${dir}${sep}`);
}

/** `file → target`, relative to src/, for a readable failure. */
function describeImport({ file, target }: Import): string {
  return `${relative(SRC, file)} → ${relative(SRC, target)}`;
}

const IMPORTS = sourceFiles(SRC).flatMap(importsOf);
const TOOL_FOLDERS = readdirSync(TOOLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const PLATFORMS = TOOL_FOLDERS.filter((name) => existsSync(join(SRC, name)));

describe("platforms", () => {
  // A tools folder without its domain module would skip every check below.
  it("pairs every tools folder with a domain module of the same name", () => {
    expect(PLATFORMS).toEqual(TOOL_FOLDERS);
  });
});

describe.each(PLATFORMS)("the %s platform", (platform) => {
  const domain = join(SRC, platform);
  const tools = join(TOOLS, platform);

  it("is imported from outside only through its index.ts", () => {
    const leaks = IMPORTS.filter(
      ({ file, target }) =>
        isInside(target, domain) &&
        !isInside(file, domain) &&
        target !== join(domain, INDEX),
    );

    expect(leaks.map(describeImport)).toEqual([]);
  });

  it("is imported only by its own tools", () => {
    const leaks = IMPORTS.filter(
      ({ file, target }) =>
        isInside(target, domain) &&
        !isInside(file, domain) &&
        !isInside(file, tools),
    );

    expect(leaks.map(describeImport)).toEqual([]);
  });

  it("has its tools reached only by the registry, through their index.ts", () => {
    const leaks = IMPORTS.filter(
      ({ file, target }) =>
        isInside(target, tools) &&
        !isInside(file, tools) &&
        !(file === REGISTRY && target === join(tools, INDEX)),
    );

    expect(leaks.map(describeImport)).toEqual([]);
  });

  it("never imports the CLI from its domain module", () => {
    const leaks = IMPORTS.filter(
      ({ file, target }) => isInside(file, domain) && isInside(target, CLI),
    );

    expect(leaks.map(describeImport)).toEqual([]);
  });
});
