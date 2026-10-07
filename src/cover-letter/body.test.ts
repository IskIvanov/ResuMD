import { describe, it, expect } from "vitest";
import { CoverLetterLimit } from "../rx-resume/schema.ts";
import { CoverLetterLayout, CoverLetterTemplate } from "../rx-resume/types.ts";
import { toCreateBody, toUpdateBody } from "./body.ts";
import { parsedLetter, TODAY } from "./mocks.ts";

const required = { name: "Acme — Frontend", resumeId: "resume-1" };

describe("toCreateBody", () => {
  it("sends the text freeform, dated today, linked to the resume", () => {
    expect(toCreateBody(parsedLetter, required, TODAY)).toStrictEqual({
      name: "Acme — Frontend",
      resumeId: "resume-1",
      recipient: parsedLetter.recipient,
      content: parsedLetter.content,
      layout: CoverLetterLayout.Freeform,
      letterDate: TODAY,
    });
  });

  it("sends --company as recipientCompany, with the other optional flags", () => {
    const body = toCreateBody(
      parsedLetter,
      {
        ...required,
        applicationId: "application-1",
        company: "Acme BV",
        template: CoverLetterTemplate.Onyx,
      },
      TODAY,
    );

    expect(body).toMatchObject({
      applicationId: "application-1",
      recipientCompany: "Acme BV",
      template: CoverLetterTemplate.Onyx,
    });
  });

  it("rejects a name over the API's limit before any request", () => {
    const name = "x".repeat(CoverLetterLimit.NameMax + 1);

    expect(() =>
      toCreateBody(parsedLetter, { ...required, name }, TODAY),
    ).toThrow(/Invalid cover letter request:\n {2}name:/);
  });
});

describe("toUpdateBody", () => {
  it("sends the text and today's date at the given revision, leaving out flags not given", () => {
    expect(toUpdateBody(parsedLetter, {}, 3, TODAY)).toStrictEqual({
      expectedRevision: 3,
      recipient: parsedLetter.recipient,
      content: parsedLetter.content,
      letterDate: TODAY,
    });
  });

  it("sends the flags given, --company as recipientCompany", () => {
    const body = toUpdateBody(
      parsedLetter,
      { name: "Renamed", company: "Acme BV", resumeId: "resume-2" },
      3,
      TODAY,
    );

    expect(body).toMatchObject({
      name: "Renamed",
      recipientCompany: "Acme BV",
      resumeId: "resume-2",
    });
  });

  it("never sends a layout, which PUT can't change", () => {
    expect(toUpdateBody(parsedLetter, required, 3, TODAY)).not.toHaveProperty(
      "layout",
    );
  });
});
