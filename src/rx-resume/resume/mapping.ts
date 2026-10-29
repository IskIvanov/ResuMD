/**
 * mapping.ts
 *
 * Writes a parsed Resume.md into a resume's `data`. `PUT /resumes/{id}`
 * validates every required field, so each item is built whole: the fields
 * Resume.md feeds, empty defaults for the rest and a fresh id. Section
 * layout, the sections Resume.md doesn't feed and every other block
 * (picture, metadata, …) are kept as they are.
 */

import type {
  ParsedCertification,
  ParsedContact,
  ParsedEduItem,
  ParsedJob,
  ParsedLanguage,
  ParsedLink,
  ParsedProject,
  ParsedResume,
  ParsedSkillGroup,
} from "../../sync-resume/types.ts";
import type {
  Basics,
  BasicsCustomField,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  IdFactory,
  InterestItem,
  LanguageItem,
  ProjectItem,
  ReferenceItem,
  ResumeData,
  SkillItem,
  Website,
} from "../types.ts";

const PROTOCOL_REGEX = /^https?:\/\//i;
const DEFAULT_PROTOCOL = "https://";

/** Phosphor icons for known networks, keyed by lowercase link label. */
const NetworkIcon: Record<string, string> = {
  linkedin: "linkedin-logo",
  github: "github-logo",
  gitlab: "gitlab-logo",
  twitter: "twitter-logo",
  x: "x-logo",
};
const DEFAULT_LINK_ICON = "link";

const BULLET = "• ";
const TECH_STACK_LABEL = "Tech Stack:";
/** Labels the bold line of references under a job. */
const REFERENCE_LABEL = "Reference:";
const CREDENTIAL_ID_LABEL = "Credential ID:";
const LIST_SEPARATOR = ", ";
/** Separates the extra project links appended to a description. */
const LINK_SEPARATOR = " | ";
const LINK_ATTRIBUTES = 'target="_blank" rel="noopener noreferrer nofollow"';
/** A blank line between paragraphs of the summary. */
const PARAGRAPH_BREAK = /\n\s*\n/;

// ─── HTML ─────────────────────────────────────────────────────────────────────

function paragraph(html: string): string {
  return `<p>${html}</p>`;
}

/** An external link that opens in a new tab. */
function renderLink(link: ParsedLink): string {
  return `<a ${LINK_ATTRIBUTES} href="${link.url}">${link.label}</a>`;
}

/** The context paragraph, when there is one. */
function renderContext(context: string): string[] {
  if (!context) return [];
  return [paragraph(context)];
}

function renderBullets(bullets: string[]): string[] {
  return bullets.map((bullet) => paragraph(`${BULLET}${bullet}`));
}

/** The bold-labelled tech stack, when there is one. */
function renderStack(stack: string): string[] {
  if (!stack) return [];
  return [paragraph(`<strong>${TECH_STACK_LABEL}</strong> ${stack}`)];
}

/** One `<p>` per paragraph, hard-wrapped lines joined with a space. */
function renderSummary(summary: string): string {
  return summary
    .split(PARAGRAPH_BREAK)
    .map((text) =>
      text
        .split("\n")
        .map((line) => line.trim())
        .join(" "),
    )
    .filter((text) => text.length > 0)
    .map(paragraph)
    .join("");
}

/** Context, bullets and tech stack, then the job's references, if any. */
function renderJob(job: ParsedJob): string {
  const parts = [
    ...renderContext(job.context),
    ...renderBullets(job.bullets),
    ...renderStack(job.stack),
  ];
  if (job.references?.length) {
    const references = job.references.join(LIST_SEPARATOR);
    parts.push(paragraph(`<strong>${REFERENCE_LABEL}</strong> ${references}`));
  }
  return parts.join("");
}

/** Context and tech stack, then every link past the first, if any. */
function renderProject(
  project: ParsedProject,
  extraLinks: ParsedLink[],
): string {
  const parts = [
    ...renderContext(project.context),
    ...renderStack(project.stack),
  ];
  if (extraLinks.length > 0) {
    parts.push(paragraph(extraLinks.map(renderLink).join(LINK_SEPARATOR)));
  }
  return parts.join("");
}

/** The credential ids, or nothing when there are none. */
function renderCredentials(ids: string[]): string {
  if (ids.length === 0) return "";
  return paragraph(`${CREDENTIAL_ID_LABEL} ${ids.join(LIST_SEPARATOR)}`);
}

// ─── Items ────────────────────────────────────────────────────────────────────

function toWebsite(url: string, label: string): Website {
  return { url, label, inlineLink: false };
}

const emptyWebsite = (): Website => toWebsite("", "");

/** The header details; a bare website gets `https://` and keeps its text. */
function toBasics(
  contact: ParsedContact,
  current: Basics,
  newId: IdFactory,
): Basics {
  const { name, headline, email, phone, location, website } = contact;
  return {
    ...current,
    name,
    headline,
    email,
    phone,
    location,
    website: toBasicsWebsite(website),
    customFields: contact.profiles.map((link) => toCustomField(link, newId())),
  };
}

function toBasicsWebsite(website: string): Basics["website"] {
  if (!website || PROTOCOL_REGEX.test(website)) {
    return { url: website, label: "" };
  }
  return { url: `${DEFAULT_PROTOCOL}${website}`, label: website };
}

/** A header link, shown next to the contact details with its network icon. */
function toCustomField(link: ParsedLink, id: string): BasicsCustomField {
  return {
    id,
    icon: NetworkIcon[link.label.toLowerCase()] ?? DEFAULT_LINK_ICON,
    text: link.label,
    link: link.url,
  };
}

function toExperienceItem(job: ParsedJob, id: string): ExperienceItem {
  return {
    id,
    hidden: false,
    roles: [],
    company: job.company,
    position: job.role,
    location: job.location,
    period: job.period,
    description: renderJob(job),
    website: toWebsite(job.website, ""),
  };
}

function toSkillItem(group: ParsedSkillGroup, id: string): SkillItem {
  return {
    id,
    hidden: false,
    icon: "",
    iconColor: "",
    proficiency: "",
    level: 0,
    name: group.heading,
    keywords: [...group.items],
  };
}

function toEducationItem(edu: ParsedEduItem, id: string): EducationItem {
  return {
    id,
    hidden: false,
    website: emptyWebsite(),
    school: edu.school,
    degree: edu.degree,
    area: edu.area,
    grade: edu.grade,
    location: edu.location,
    period: edu.period,
    description: [
      ...renderContext(edu.context),
      ...renderBullets(edu.bullets),
    ].join(""),
  };
}

/**
 * The API holds one website per project, so the first link becomes it and
 * the rest are appended to the description.
 */
function toProjectItem(project: ParsedProject, id: string): ProjectItem {
  const [primary, ...extra] = project.links;
  let website = emptyWebsite();
  if (primary) website = toWebsite(primary.url, primary.label);

  return {
    id,
    hidden: false,
    period: "",
    name: project.title,
    description: renderProject(project, extra),
    website,
  };
}

/**
 * The description paragraph, then the credential ids; the entry's link, when
 * there is one, becomes the website.
 */
function toCertificationItem(
  certification: ParsedCertification,
  id: string,
): CertificationItem {
  const { link } = certification;
  let website = emptyWebsite();
  if (link) website = toWebsite(link.url, link.label);

  return {
    id,
    hidden: false,
    date: "",
    website,
    title: certification.title,
    issuer: certification.issuer,
    description: [
      ...renderContext(certification.description),
      renderCredentials(certification.credentialIds),
    ].join(""),
  };
}

function toLanguageItem(language: ParsedLanguage, id: string): LanguageItem {
  return {
    id,
    hidden: false,
    language: language.language,
    fluency: language.fluency,
    /** 0–5; 0 hides the level indicator. */
    level: language.level,
  };
}

function toInterestItem(name: string, id: string): InterestItem {
  return { id, hidden: false, icon: "", iconColor: "", keywords: [], name };
}

/** A reference line, or a note such as "References available upon request". */
function toReferenceItem(name: string, id: string): ReferenceItem {
  return {
    id,
    hidden: false,
    position: "",
    website: emptyWebsite(),
    phone: "",
    description: "",
    name,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Writes a parsed Resume.md into a resume's data, returning new data.
 *
 * Sets the basics (the header links become custom fields) and the summary,
 * and replaces the items of every section Resume.md feeds, each with a fresh
 * id.
 *
 * @param data - The resume's current data, from `GET /resumes/{id}`.
 * @param resume - Output of `parseResume`.
 * @param newId - Called once per item.
 * @returns Data ready to send as the `data` of `PUT /resumes/{id}`.
 *
 * @example
 * applyResume(current.data, parseResume(markdown), randomUUID);
 */
export function applyResume(
  data: ResumeData,
  resume: ParsedResume,
  newId: IdFactory,
): ResumeData {
  /** Replaces a section's items, giving each a fresh id. */
  function withItems<TSection extends { items: unknown[] }, TParsed>(
    section: TSection,
    parsed: TParsed[],
    toItem: (item: TParsed, id: string) => TSection["items"][number],
  ): TSection {
    return { ...section, items: parsed.map((item) => toItem(item, newId())) };
  }

  const { sections } = data;
  return {
    ...data,
    basics: toBasics(resume.contact, data.basics, newId),
    summary: { ...data.summary, content: renderSummary(resume.summary) },
    sections: {
      ...sections,
      experience: withItems(sections.experience, resume.jobs, toExperienceItem),
      skills: withItems(sections.skills, resume.skillGroups, toSkillItem),
      education: withItems(
        sections.education,
        resume.eduItems,
        toEducationItem,
      ),
      projects: withItems(sections.projects, resume.projects, toProjectItem),
      certifications: withItems(
        sections.certifications,
        resume.certifications,
        toCertificationItem,
      ),
      languages: withItems(
        sections.languages,
        resume.languages,
        toLanguageItem,
      ),
      interests: withItems(
        sections.interests,
        resume.interests,
        toInterestItem,
      ),
      references: withItems(
        sections.references,
        resume.references,
        toReferenceItem,
      ),
    },
  };
}
