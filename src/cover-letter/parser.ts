/**
 * parser.ts
 *
 * Parses a cover-letter `.md` into the text the API takes. Pure: it accepts
 * the raw Markdown and returns data, with no file I/O. The text is kept as
 * written, since the API's `content` is plain text, not HTML.
 */

import { splitSections } from "../utils/markdown.ts";
import { parseOrThrow } from "../utils/schema.ts";
import {
  CoverLetterSectionsSchema,
  ParsedCoverLetterSchema,
} from "./schema.ts";
import { CoverLetterLabel, type ParsedCoverLetter } from "./types.ts";

/** `## Heading` names the parser reads; any other section is ignored. */
export const CoverLetterHeading = {
  Contact: "Contact",
  Letter: "Letter",
  Closing: "Closing",
} as const;

const RULE = "---";
const PARAGRAPH_BREAK = "\n\n";
/** Two or more blank lines in a row, as a dropped rule leaves behind. */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/**
 * A section's text: each line trimmed, `---` rules dropped and runs of blank
 * lines collapsed to one. Paragraphs and hard line breaks are kept. Empty
 * when the section is missing.
 */
function sectionText(body: string | undefined): string {
  if (!body) return "";
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== RULE)
    .join("\n")
    .replace(EXTRA_BLANK_LINES, PARAGRAPH_BREAK)
    .trim();
}

/**
 * Parses a cover-letter `.md` and checks it against the API's limits.
 *
 * @param md - The full `.md` string.
 * @returns `## Contact` as the recipient, and `## Letter`, a blank line and
 *   `## Closing` as the content.
 * @throws If a section is missing or empty, naming it (e.g.
 *   `closing: required`), or if the text is over the API's limits.
 *
 * @example
 * parseCoverLetter("## Contact\nAlex\n## Letter\nDear Alex,\n## Closing\nJane");
 * // { recipient: "Alex", content: "Dear Alex,\n\nJane" }
 */
export function parseCoverLetter(md: string): ParsedCoverLetter {
  const sections = splitSections(md);
  const contactSection = sections[CoverLetterHeading.Contact];
  const letterSection = sections[CoverLetterHeading.Letter];
  const closingSection = sections[CoverLetterHeading.Closing];
  const { contact, letter, closing } = parseOrThrow(
    CoverLetterSectionsSchema,
    {
      contact: sectionText(contactSection),
      letter: sectionText(letterSection),
      closing: sectionText(closingSection),
    },
    CoverLetterLabel.InvalidLetter,
  );

  return parseOrThrow(
    ParsedCoverLetterSchema,
    { recipient: contact, content: [letter, closing].join(PARAGRAPH_BREAK) },
    CoverLetterLabel.InvalidLetter,
  );
}
