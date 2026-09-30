/**
 * apply-data.ts
 *
 * Pure functions that apply ParsedResumeData onto a resume's full `data`
 * object. `PUT /resumes/{id}` validates every required field, so parsed items
 * are completed with empty defaults and a fresh id; everything Resume.md does
 * not feed is carried over from the given data unchanged.
 */

import type {
  BasicsCustomField,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  InterestItem,
  LanguageItem,
  ParsedCertificationItem,
  ParsedCustomField,
  ParsedEducationItem,
  ParsedExperienceItem,
  ParsedInterestItem,
  ParsedLanguageItem,
  ParsedProjectItem,
  ParsedReferenceItem,
  ParsedResumeData,
  ParsedSkillItem,
  ProjectItem,
  ReferenceItem,
  ResumeData,
  Section,
  SkillItem,
  Website,
} from "./types.ts";

/** Produces a unique item id; `crypto.randomUUID` in production. */
export type IdFactory = () => string;

/** Completes a parsed item into a full API item with the given id. */
type ItemCompleter<TParsed, TItem> = (item: TParsed, id: string) => TItem;

function emptyWebsite(): Website {
  return { url: "", label: "", inlineLink: false };
}

// ─── Item completion ──────────────────────────────────────────────────────────

/**
 * Completes a parsed header link into a full API custom field.
 *
 * @param field - The parsed icon, text and link.
 * @param id - The id to give the new field.
 * @returns The field with its id.
 */
export function toApiCustomField(
  field: ParsedCustomField,
  id: string,
): BasicsCustomField {
  return { id, ...field };
}

/**
 * Completes a parsed experience item into a full API item.
 *
 * @param item - The parsed company, position, location, period, description
 *   and optional website.
 * @param id - The id to give the new item.
 * @returns A visible item with no roles, and an empty website unless parsed.
 */
export function toApiExperienceItem(
  item: ParsedExperienceItem,
  id: string,
): ExperienceItem {
  return {
    id,
    hidden: false,
    roles: [],
    ...item,
    website: item.website ?? emptyWebsite(),
  };
}

/**
 * Completes a parsed skill item into a full API item.
 *
 * @param item - The parsed skill group name and keywords.
 * @param id - The id to give the new item.
 * @returns A visible item with no icon, proficiency or level.
 */
export function toApiSkillItem(item: ParsedSkillItem, id: string): SkillItem {
  return {
    id,
    hidden: false,
    icon: "",
    iconColor: "",
    proficiency: "",
    level: 0,
    ...item,
  };
}

/**
 * Completes a parsed education item into a full API item.
 *
 * @param item - The parsed school, degree, location, period and description.
 * @param id - The id to give the new item.
 * @returns A visible item with empty area, grade and website.
 */
export function toApiEducationItem(
  item: ParsedEducationItem,
  id: string,
): EducationItem {
  return {
    id,
    hidden: false,
    area: "",
    grade: "",
    website: emptyWebsite(),
    ...item,
  };
}

/**
 * Completes a parsed project item into a full API item.
 *
 * @param item - The parsed project name, description and optional website.
 * @param id - The id to give the new item.
 * @returns A visible item with an empty period, and an empty website unless
 *   parsed.
 */
export function toApiProjectItem(
  item: ParsedProjectItem,
  id: string,
): ProjectItem {
  return {
    id,
    hidden: false,
    period: "",
    ...item,
    website: item.website ?? emptyWebsite(),
  };
}

/**
 * Completes a parsed certification item into a full API item.
 *
 * @param item - The parsed title, issuer and description.
 * @param id - The id to give the new item.
 * @returns A visible item with empty date and website.
 */
export function toApiCertificationItem(
  item: ParsedCertificationItem,
  id: string,
): CertificationItem {
  return { id, hidden: false, date: "", website: emptyWebsite(), ...item };
}

/**
 * Completes a parsed language item into a full API item.
 *
 * @param item - The parsed language and fluency.
 * @param id - The id to give the new item.
 * @returns A visible item with no level indicator.
 */
export function toApiLanguageItem(
  item: ParsedLanguageItem,
  id: string,
): LanguageItem {
  return { id, hidden: false, level: 0, ...item };
}

/**
 * Completes a parsed interest item into a full API item.
 *
 * @param item - The parsed interest name.
 * @param id - The id to give the new item.
 * @returns A visible item with no icon or keywords.
 */
export function toApiInterestItem(
  item: ParsedInterestItem,
  id: string,
): InterestItem {
  return { id, hidden: false, icon: "", iconColor: "", keywords: [], ...item };
}

/**
 * Completes a parsed reference item into a full API item.
 *
 * @param item - The parsed reference name or note.
 * @param id - The id to give the new item.
 * @returns A visible item with empty position, website, phone and description.
 */
export function toApiReferenceItem(
  item: ParsedReferenceItem,
  id: string,
): ReferenceItem {
  return {
    id,
    hidden: false,
    position: "",
    website: emptyWebsite(),
    phone: "",
    description: "",
    ...item,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Applies parsed data onto a resume's `data`, returning a new object.
 *
 * Sets the basics (its custom fields are the header links) and the summary
 * content, and replaces the items of every section Resume.md feeds. Section
 * layout, the other sections and every other block (picture, metadata, …) are
 * kept as they are.
 *
 * @param data - The resume's current data, e.g. from `GET /resumes/{id}`.
 * @param parsed - Output of `toResumeData`.
 * @param newId - Called once per item.
 * @returns Data ready to send as the `data` of `PUT /resumes/{id}`.
 *
 * @example
 * applyResumeData(resume.data, toResumeData(parsed), () => crypto.randomUUID());
 */
export function applyResumeData(
  data: ResumeData,
  parsed: ParsedResumeData,
  newId: IdFactory,
): ResumeData {
  /** Replaces a section's items with completed parsed items. */
  function withItems<TSection extends Section<TItem>, TParsed, TItem>(
    section: TSection,
    items: TParsed[],
    complete: ItemCompleter<TParsed, TItem>,
  ): TSection {
    return { ...section, items: items.map((item) => complete(item, newId())) };
  }

  const current = data.sections;
  const next = parsed.sections;

  return {
    ...data,
    basics: {
      ...data.basics,
      ...parsed.basics,
      customFields: parsed.basics.customFields.map((field) =>
        toApiCustomField(field, newId()),
      ),
    },
    summary: { ...data.summary, content: parsed.summary.content },
    sections: {
      ...current,
      experience: withItems(
        current.experience,
        next.experience.items,
        toApiExperienceItem,
      ),
      skills: withItems(current.skills, next.skills.items, toApiSkillItem),
      education: withItems(
        current.education,
        next.education.items,
        toApiEducationItem,
      ),
      projects: withItems(
        current.projects,
        next.projects.items,
        toApiProjectItem,
      ),
      certifications: withItems(
        current.certifications,
        next.certifications.items,
        toApiCertificationItem,
      ),
      languages: withItems(
        current.languages,
        next.languages.items,
        toApiLanguageItem,
      ),
      interests: withItems(
        current.interests,
        next.interests.items,
        toApiInterestItem,
      ),
      references: withItems(
        current.references,
        next.references.items,
        toApiReferenceItem,
      ),
    },
  };
}
