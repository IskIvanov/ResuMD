/**
 * types.ts
 *
 * Every type update-rx-resume declares, in one place.
 */

/** Options parsed from the update-rx-resume command line. */
export interface UpdateOptions {
  /** Id of the resume to update, as generate-rx-resume prints. */
  id: string;
  /** Absolute path to the source-of-truth Resume.md. */
  resume: string;
}
