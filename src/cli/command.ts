/**
 * command.ts
 *
 * Formats the flag command that matches an interactive run, so the user can
 * see — and later reuse — exactly what is about to run.
 */

/** Characters that are safe in a shell word without quoting. */
const SAFE_WORD = /^[\w@%+=:,./-]+$/;

/** Wraps a value in double quotes when the shell would split or expand it. */
function quote(value: string): string {
  if (SAFE_WORD.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

/**
 * Joins a command and its argv into one copy-pasteable shell line.
 *
 * @param command - The tool's flag command, e.g. "bun run sync".
 * @param argv - Flags and values, as passed to the tool.
 * @returns The command line, with values quoted where needed.
 *
 * @example
 * formatCommand("bun run stub", ["--name", "Jane Doe"]);
 * // 'bun run stub --name "Jane Doe"'
 */
export function formatCommand(
  command: string,
  argv: readonly string[],
): string {
  return [command, ...argv.map(quote)].join(" ");
}
