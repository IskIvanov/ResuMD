/**
 * markdown.ts
 *
 * Generic Markdown helpers, shared by every `.md` the tools read.
 */

/** Opens a section; the leading newline anchors it to the start of a line. */
const SECTION_HEADING = /\n## /;

/**
 * Splits a Markdown string into a map of `## Heading` → the section's text.
 * Prepends a newline so the first heading is always found by /\n## /.
 *
 * @param markdown - A Markdown string, e.g. Resume.md or a cover letter.
 * @returns Each section's text, as written, keyed by its trimmed heading.
 *   Text above the first `## ` heading is left out.
 *
 * @example
 * splitSections("# Jane\n## Summary\nHello\n");
 * // { Summary: "Hello\n" }
 */
export function splitSections(markdown: string): Record<string, string> {
  return Object.fromEntries(
    `\n${markdown}`
      .split(SECTION_HEADING)
      .slice(1)
      .map((headingAndText) => {
        const newlineIndex = headingAndText.indexOf("\n");
        const heading = headingAndText.slice(0, newlineIndex).trim();
        const sectionText = headingAndText.slice(newlineIndex + 1);
        return [heading, sectionText];
      }),
  );
}
