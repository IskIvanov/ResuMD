/**
 * mocks.ts
 *
 * Every fixture the apply-job tests use: an applicant and CV files.
 * Typed constants and small factories only.
 */

import { PDF_BYTES } from "../cv-base64/mocks.ts";
import type { ApplicantDetails, CvFile } from "./types.ts";

export const applicant: ApplicantDetails = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  telephone: "+31 6 12345678",
  motivation: "I want to help build the energy transition.",
  linkedinUrl: "https://www.linkedin.com/in/jane-doe",
  githubUrl: "https://github.com/jane-doe",
};

export const pdfCv: CvFile = { path: "/cv/Resume.pdf", bytes: PDF_BYTES };

/** The CV with an upper-case extension, as some exporters write it. */
export const upperCaseDocxCv: CvFile = {
  path: "/cv/Resume.DOCX",
  bytes: PDF_BYTES,
};

/** A CV format the API doesn't accept. */
export const textCv: CvFile = { path: "/cv/Resume.txt", bytes: PDF_BYTES };
