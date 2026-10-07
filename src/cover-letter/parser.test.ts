import { describe, it, expect } from "vitest";
import { CoverLetterLimit } from "../rx-resume/schema.ts";
import {
  COVER_LETTER_MD,
  parsedLetter,
  withEmptySection,
  withoutSection,
} from "./mocks.ts";
import { CoverLetterHeading, parseCoverLetter } from "./parser.ts";

describe("parseCoverLetter", () => {
  it("turns Contact into the recipient, and Letter and Closing into the content", () => {
    expect(parseCoverLetter(COVER_LETTER_MD)).toEqual(parsedLetter);
  });

  it("drops --- rules and ignores other sections", () => {
    const { recipient, content } = parseCoverLetter(COVER_LETTER_MD);

    expect(`${recipient}\n${content}`).not.toContain("---");
    expect(content).not.toContain("Not part of the letter");
  });

  it("trims each line and keeps hard line breaks", () => {
    const md =
      "## Contact\n  Alex Smith  \nAcme BV\n## Letter\nHi\n## Closing\nBye,\nJane";

    expect(parseCoverLetter(md)).toEqual({
      recipient: "Alex Smith\nAcme BV",
      content: "Hi\n\nBye,\nJane",
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

  it("rejects a recipient over the API's limit", () => {
    const md = COVER_LETTER_MD.replace(
      "Amsterdam, Netherlands",
      "x".repeat(CoverLetterLimit.RecipientMax + 1),
    );

    expect(() => parseCoverLetter(md)).toThrow("recipient:");
  });
});
