import { describe, it, expect } from "vitest";
import { PDF_BASE64 } from "../cv-base64/mocks.ts";
import { CvExtension } from "../careers-api/schema.ts";
import { applicant, pdfCv, textCv, upperCaseDocxCv } from "./mocks.ts";
import { buildApplicationPayload, parseApplyMode } from "./payload.ts";
import { ApplicantDetails, ApplyMode } from "./types.ts";
import { ApplicationPayload } from "../careers-api/types.ts";

const ApplicationPayloadMock: ApplicationPayload = {
  first_name: applicant.firstName,
  last_name: applicant.lastName,
  email: applicant.email,
  telephone: applicant.telephone,
  motivation: applicant.motivation,
  cv: PDF_BASE64,
  cv_extension: CvExtension.Pdf,
  linkedin_url: applicant.linkedinUrl,
  github_url: applicant.githubUrl,
  test: true,
};

describe("buildApplicationPayload", () => {
  it("maps the applicant to the API's fields, with the CV as base64", () => {
    expect(buildApplicationPayload(applicant, pdfCv, ApplyMode.Test)).toEqual(
      ApplicationPayloadMock,
    );
  });
});
it("sends test: false only in live mode", () => {
  expect(buildApplicationPayload(applicant, pdfCv, ApplyMode.Live).test).toBe(
    false,
  );
});

it("takes cv_extension from the file name, ignoring case", () => {
  expect(
    buildApplicationPayload(applicant, upperCaseDocxCv, ApplyMode.Test)
      .cv_extension,
  ).toBe(CvExtension.Docx);
});

it("throws listing every invalid field", () => {
  const applicationt: ApplicantDetails = {
    ...applicant,
    email: "jane@",
  };
  expect(() =>
    buildApplicationPayload(applicationt, textCv, ApplyMode.Test),
  ).toThrow(/email: .*\n {2}cv_extension: /);
});

describe("parseApplyMode", () => {
  it("accepts test and live", () => {
    expect(parseApplyMode("test")).toBe(ApplyMode.Test);
    expect(parseApplyMode("live")).toBe(ApplyMode.Live);
  });

  it("throws on any other value", () => {
    expect(() => parseApplyMode("yolo")).toThrow(/"yolo".*test or live/);
  });
});
