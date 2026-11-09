/**
 * changes.ts
 *
 * Compares a resume's stored data with what a write would save, section by
 * section. A section Resume.md feeds but says nothing about would lose every
 * visible item, so a write refuses that instead of saving it, unless the
 * section is optional.
 */

import type { ResumeData } from "../../api/types.ts";

/** The sections Resume.md feeds, in reading order. */
const FED_SECTIONS = [
  "experience",
  "skills",
  "education",
  "projects",
  "certifications",
  "languages",
  "interests",
  "references",
] as const;

/** Sections Resume.md may leave out, clearing their visible items. */
const OPTIONAL_SECTIONS: ReadonlySet<string> = new Set(["references"]);

/** What a write would do to one section. */
export interface SectionChange {
  section: (typeof FED_SECTIONS)[number];
  /** Visible items stored now. */
  before: number;
  /** Visible items after the write. */
  after: number;
  /** Hidden items the write keeps. */
  hiddenKept: number;
  /** True when the write would remove every visible item of a section
   * Resume.md may not leave out. */
  emptied: boolean;
}

/** Items the resume shows: none in a hidden section. */
function countVisible(section: {
  hidden: boolean;
  items: { hidden: boolean }[];
}): number {
  if (section.hidden) return 0;
  return section.items.filter((item) => !item.hidden).length;
}

/**
 * Compares every section Resume.md feeds.
 *
 * @param currentData - The resume's stored data.
 * @param newData - What the write would save.
 * @returns One change per section.
 *
 * @example
 * compareSections(data, applyResumeMd(data, resumeMd, newId))[0];
 * // { section: "experience", before: 8, after: 8, hiddenKept: 0, emptied: false }
 */
export function compareSections(
  currentData: ResumeData,
  newData: ResumeData,
): SectionChange[] {
  return FED_SECTIONS.map((section) => {
    const before = countVisible(currentData.sections[section]);
    const after = countVisible(newData.sections[section]);
    return {
      section,
      before,
      after,
      hiddenKept: newData.sections[section].items.filter((item) => item.hidden)
        .length,
      emptied: before > 0 && after === 0 && !OPTIONAL_SECTIONS.has(section),
    };
  });
}

/**
 * Refuses a write that would empty a section.
 *
 * @param changes - The comparison from `compareSections`.
 * @throws If any section would lose all of its visible items, naming them.
 *
 * @example
 * assertNoSectionEmptied(compareSections(currentData, newData));
 */
export function assertNoSectionEmptied(changes: SectionChange[]): void {
  const emptied = changes
    .filter((change) => change.emptied)
    .map((change) => change.section);
  if (emptied.length === 0) return;
  throw new Error(
    `Resume.md has nothing for: ${emptied.join(", ")}. Nothing was saved, ` +
      "because that would delete those items. Check the section's heading " +
      "(a renamed one isn't read), or clear the section in Reactive Resume " +
      "first.",
  );
}
