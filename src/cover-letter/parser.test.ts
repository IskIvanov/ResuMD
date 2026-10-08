import { describe, it, expect } from "vitest";
import { CoverLetterLimit } from "../rx-resume/schema.ts";
import {
  COVER_LETTER_MD,
  parsedLetter,
  withEmptySection,
  withoutSection,
} from "./mocks.ts";
import { CoverLetterHeading, parseCoverLetter } from "./parser.ts";

/** The body of each required section; any left out is one short line. */
interface LetterSections {
  contact?: string;
  letter?: string;
  closing?: string;
}

/** A minimal cover-letter `.md` with only the three required sections. */
function buildLetterMd({
  contact = "Alex",
  letter = "Hi",
  closing = "Jane",
}: LetterSections = {}): string {
  return [
    "## Contact",
    contact,
    "## Letter",
    letter,
    "## Closing",
    closing,
  ].join("\n");
}

describe("parseCoverLetter", () => {
  it("turns Contact into the recipient, and Letter and Closing into the content", () => {
    expect(parseCoverLetter(COVER_LETTER_MD)).toEqual(parsedLetter);
  });

  it("trims each line and keeps hard line breaks", () => {
    const md = buildLetterMd({
      contact: "  Alex Smith  \nAcme BV",
      closing: "Bye,\nJane",
    });

    expect(parseCoverLetter(md)).toEqual({
      recipient: "Alex Smith\nAcme BV",
      content: "Hi\n\nBye,\nJane",
    });
  });

  it("drops a --- rule between paragraphs, leaving one blank line", () => {
    const md = buildLetterMd({ letter: "First.\n\n---\n\nSecond." });

    expect(parseCoverLetter(md).content).toBe("First.\n\nSecond.\n\nJane");
  });

  it("ignores the title and sections other than Contact, Letter and Closing", () => {
    const md = [
      "# Cover letter: Acme BV",
      "## Contact",
      "Alex",
      "## Letter",
      "Hi",
      "## Notes",
      "Send before Friday.",
      "## Closing",
      "Jane",
    ].join("\n");

    expect(parseCoverLetter(md)).toEqual({
      recipient: "Alex",
      content: "Hi\n\nJane",
    });
  });

  it.each([
    [CoverLetterHeading.Contact, "contact"],
    [CoverLetterHeading.Letter, "letter"],
    [CoverLetterHeading.Closing, "closing"],
  ])("names ## %s when it's missing or empty", (heading, path) => {
    const error = `${path}: required`;

    expect(() => parseCoverLetter(withoutSection(heading))).toThrow(error);
    expect(() => parseCoverLetter(withEmptySection(heading))).toThrow(error);
  });

  it("accepts a recipient at the API's limit", () => {
    const recipient = "x".repeat(CoverLetterLimit.RecipientMax);

    expect(
      parseCoverLetter(buildLetterMd({ contact: recipient })).recipient,
    ).toBe(recipient);
  });

  it("rejects a recipient over the API's limit", () => {
    const md = buildLetterMd({
      contact: "x".repeat(CoverLetterLimit.RecipientMax + 1),
    });

    expect(() => parseCoverLetter(md)).toThrow("recipient: Too big");
  });

  it("applies the content limit to Letter and Closing together", () => {
    const closing = "Jane";
    // The letter alone fits; with the blank line and closing it does not.
    const letter = "x".repeat(CoverLetterLimit.ContentMax - closing.length);

    expect(() => parseCoverLetter(buildLetterMd({ letter, closing }))).toThrow(
      "content: Too big",
    );
  });
});
