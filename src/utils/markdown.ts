/**
 * markdown.ts
 *
 * Generic Markdown helpers, shared by every `.md` the tools read.
 */

/** Opens a section; the leading newline anchors it to the start of a line. */
const SECTION_HEADING = /\n## /;

/**
 * Splits a Markdown string into a map of `## Heading` → body.
 * Prepends a newline so the first heading is always found by /\n## /.
 *
 * @param md - A Markdown string, e.g. Resume.md or a cover letter.
 * @returns Each section's body, as written, keyed by its trimmed heading.
 *   Text above the first `## ` heading is left out.
 *
 * @example
 * splitSections("# Jane\n## Summary\nHello\n");
 * // { Summary: "Hello\n" }
 */
export function splitSections(md: string): Record<string, string> {
  return Object.fromEntries(
    ("\n" + md)
      .split(SECTION_HEADING)
      .slice(1)
      .map((part) => {
        const newlineIdx = part.indexOf("\n");
        const heading = part.slice(0, newlineIdx).trim();
        const body = part.slice(newlineIdx + 1);
        return [heading, body];
      }),
  );
}
