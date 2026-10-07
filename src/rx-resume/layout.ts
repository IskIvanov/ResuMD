/**
 * layout.ts
 *
 * Pure functions that set the order in which a resume's sections appear.
 * Reactive Resume keeps that order in `metadata.layout`, as lists of section
 * ids per page and column.
 */

import type { ValueOf } from "../utils/type.ts";
import type { Layout, ResumeData } from "./types.ts";

/** Ids of the built-in sections, as used in `metadata.layout`. */
export const SectionId = {
  Summary: "summary",
  Profiles: "profiles",
  Experience: "experience",
  Education: "education",
  Projects: "projects",
  Skills: "skills",
  Languages: "languages",
  Interests: "interests",
  Awards: "awards",
  Certifications: "certifications",
  Publications: "publications",
  Volunteer: "volunteer",
  References: "references",
} as const;
export type SectionId = ValueOf<typeof SectionId>;

/** The order generated resumes use; unlisted sections follow these. */
export const SECTION_ORDER: readonly SectionId[] = [
  SectionId.Summary,
  SectionId.Skills,
  SectionId.Experience,
  SectionId.Education,
  SectionId.Projects,
  SectionId.Languages,
  SectionId.Certifications,
  SectionId.References,
  SectionId.Interests,
];

/** Every section id in a layout, page by page, main column before sidebar. */
function listSections(layout: Layout): string[] {
  return layout.pages.flatMap((page) => [...page.main, ...page.sidebar]);
}

/**
 * Sets the section order of a resume, returning new data.
 *
 * A single order needs a single column, so the layout becomes one full-width
 * page: the given sections first, then every other section the layout had
 * (profiles, awards, custom sections, …) in its existing order.
 *
 * @param data - The resume's data, e.g. the output of `applyResumeData`.
 * @param order - Section ids in the order they should appear.
 * @returns The data with `metadata.layout.pages` replaced; the sidebar width
 *   and the rest of the metadata are kept.
 *
 * @example
 * applySectionOrder(data, SECTION_ORDER).metadata.layout.pages[0].main;
 * // ["summary", "skills", "experience", …]
 */
export function applySectionOrder(
  data: ResumeData,
  order: readonly string[],
): ResumeData {
  const { layout } = data.metadata;
  const main = [...new Set([...order, ...listSections(layout)])];

  return {
    ...data,
    metadata: {
      ...data.metadata,
      layout: { ...layout, pages: [{ fullWidth: true, main, sidebar: [] }] },
    },
  };
}
