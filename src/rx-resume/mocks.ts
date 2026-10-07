/**
 * mocks.ts
 *
 * Cover-letter fixtures shared by the rx-resume and cover-letter tests: a
 * create body, an update body, the API's response, and one invalid variant
 * per field rule. Typed constants only.
 */

import { CoverLetterLimit } from "./schema.ts";
import {
  CoverLetterLayout,
  type CoverLetter,
  type CreateCoverLetterBody,
  type UpdateCoverLetterBody,
} from "./types.ts";

export const LETTER_ID = "letter-1";
export const LETTER_REVISION = 3;
export const LETTER_DATE = "2026-10-06";

const recipient = "Alex Smith\nAcme BV\nAmsterdam, Netherlands";
const content = "Dear Alex,\n\nI'd like to apply.\n\nKind regards,\nJane Doe";

export const createCoverLetterBody: CreateCoverLetterBody = {
  name: "Acme — Frontend",
  recipient,
  content,
  resumeId: "resume-1",
  layout: CoverLetterLayout.Freeform,
  letterDate: LETTER_DATE,
};

export const updateCoverLetterBody: UpdateCoverLetterBody = {
  expectedRevision: LETTER_REVISION,
  recipient,
  content,
  letterDate: LETTER_DATE,
};

/** The letter as `GET /cover-letters/{id}` returns it, sender linked. */
export const coverLetter: CoverLetter = {
  id: LETTER_ID,
  name: "Acme — Frontend",
  revision: LETTER_REVISION,
  recipient,
  content,
  layout: CoverLetterLayout.Freeform,
  recipientCompany: "",
  letterDate: LETTER_DATE,
  senderLinked: true,
  designLinked: true,
  isLocked: false,
  style: {
    basics: {
      name: "Jane Doe",
      headline: "Software Engineer",
      email: "jane.doe@example.com",
      phone: "",
      location: "City, Country",
      website: { url: "https://example.com", label: "" },
      customFields: [],
    },
  },
};

/** One field that breaks a create or update body, and what it breaks. */
export interface InvalidLetterFieldCase {
  rule: string;
  field: Partial<Record<keyof CreateCoverLetterBody, unknown>>;
}

export const invalidLetterFieldCases: readonly InvalidLetterFieldCase[] = [
  {
    rule: "a name over the length limit",
    field: { name: "x".repeat(CoverLetterLimit.NameMax + 1) },
  },
  {
    rule: "a letterDate that isn't YYYY-MM-DD",
    field: { letterDate: "06/10/2026" },
  },
  { rule: "an unknown template", field: { template: "charizard" } },
];
