/**
 * parser.ts
 *
 * Parses a cover-letter `.md` into the text the API takes. Pure: it accepts
 * the raw Markdown and returns data, with no file I/O. The text is kept as
 * written, since the API's `content` is plain text, not HTML.
 */

import { splitSections } from "../../../utils/markdown.ts";
import { parseOrThrow } from "../../../utils/schema.ts";
import {
  CoverLetterSectionsSchema,
  CoverLetterTextSchema,
} from "../../schema.ts";
import type { CoverLetterText } from "../../types.ts";

/** `## Heading` names the parser reads; any other section is ignored. */
const CoverLetterHeading = {
  Recipient: "Recipient",
  Letter: "Letter",
  SignOff: "Sign-off",
} as const;

/** Heads the error for a letter missing a section or over the limits. */
const INVALID_LETTER = "Invalid cover letter:";

const RULE = "---";
const PARAGRAPH_BREAK = "\n\n";
/** Two or more blank lines in a row, as a dropped rule leaves behind. */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/**
 * A section's text: each line trimmed, `---` rules dropped and runs of blank
 * lines collapsed to one. Paragraphs and hard line breaks are kept. Empty
 * when the section is missing.
 */
function sectionText(sectionMarkdown: string | undefined): string {
  if (!sectionMarkdown) return "";
  return sectionMarkdown
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
 * @param markdown - The full cover-letter `.md` text.
 * @returns `## Recipient` as the recipient block, and `## Letter`, a blank
 *   line and `## Sign-off` as the content.
 * @throws If a section is missing or empty, naming it (e.g.
 *   `signOff: required`), or if the text is over the API's limits.
 *
 * @example
 * parseCoverLetter("## Recipient\nAlex\n## Letter\nDear Alex,\n## Sign-off\nJane");
 * // { recipient: "Alex", content: "Dear Alex,\n\nJane" }
 */
export function parseCoverLetter(markdown: string): CoverLetterText {
  const sections = splitSections(markdown);
  const {
    recipient,
    letter: body,
    signOff,
  } = parseOrThrow(
    CoverLetterSectionsSchema,
    {
      recipient: sectionText(sections[CoverLetterHeading.Recipient]),
      letter: sectionText(sections[CoverLetterHeading.Letter]),
      signOff: sectionText(sections[CoverLetterHeading.SignOff]),
    },
    INVALID_LETTER,
  );

  return parseOrThrow(
    CoverLetterTextSchema,
    { recipient, content: [body, signOff].join(PARAGRAPH_BREAK) },
    INVALID_LETTER,
  );
}
