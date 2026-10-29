/**
 * print.ts
 *
 * How the Reactive Resume tools report what they wrote.
 */

import type {
  CoverLetterResult,
  ResumeResult,
} from "../../../rx-resume/index.ts";

enum PrintLabel {
  Builder = "  builder:",
  Letter = "  letter:",
}

const DETAIL_SEPARATOR = ", ";

/**
 * Prints a written cover letter and its dashboard link. The template is shown
 * only when one was chosen, since the letter then no longer follows the
 * resume's design.
 *
 * @param label - What happened, e.g. `✓ Created cover letter`.
 * @param letter - The operation's result.
 * @param template - The template chosen with --template, if any.
 *
 * @example
 * printLetter("✓ Created cover letter", result, undefined);
 * // ✓ Created cover letter "Acme — Frontend" (id …, revision 1)
 * //   letter: https://rxresu.me/dashboard/…
 */
export function printLetter(
  label: string,
  letter: CoverLetterResult,
  template: string | undefined,
): void {
  const details = [`id ${letter.id}`, `revision ${letter.revision}`];
  if (template) details.push(`template ${template}`);
  console.log(`${label} "${letter.name}" (${details.join(DETAIL_SEPARATOR)})`);
  console.log(`${PrintLabel.Letter} ${letter.dashboardUrl}`);
}

/**
 * Prints a written resume and its builder link.
 *
 * @param label - What happened, e.g. `✓ Updated`.
 * @param resume - The operation's result.
 *
 * @example
 * printResume("✓ Updated", result);
 * // ✓ Updated "Jane Doe" (slug jane-doe, id …)
 * //   builder: https://rxresu.me/builder/…
 */
export function printResume(label: string, resume: ResumeResult): void {
  console.log(
    `${label} "${resume.name}" (slug ${resume.slug}, id ${resume.id})`,
  );
  console.log(`${PrintLabel.Builder} ${resume.builderUrl}`);
}
