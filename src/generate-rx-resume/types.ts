/**
 * types.ts
 *
 * Every type generate-rx-resume declares, in one place. The Reactive Resume
 * shapes they build on are inferred from the Zod schemas in
 * ../rx-resume/schema.ts.
 */

import type { CreateResumeBody, ParsedResumeData } from "../rx-resume/types.ts";

/** Options parsed from the generate-rx-resume command line. */
export interface GenerateOptions {
  /** Absolute path to the source-of-truth Resume.md. */
  resume: string;
  /** Resume name shown in Reactive Resume. */
  name: string;
  /** URL slug; must be unique across your resumes. */
  slug: string;
  tags: string[];
}

/** The new resume's name, slug and tags, plus the parsed data to fill it. */
export interface GenerateResumeInput extends Omit<
  CreateResumeBody,
  "withSampleData"
> {
  data: ParsedResumeData;
}
