/**
 * mapping.ts
 *
 * Writes what Resume.md says into a resume's `data`. `PUT /resumes/{id}`
 * validates every required field, so each item is built whole: the fields
 * Resume.md feeds, empty defaults for the rest and a fresh id. Section
 * layout, the sections Resume.md doesn't feed and every other block
 * (picture, metadata, …) are kept as they are.
 */

import type {
  Certification,
  Header,
  School,
  Job,
  Language,
  Link,
  Project,
  ResumeMd,
  SkillGroup,
} from "../../../resume-md/types.ts";
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
} from "../../api/types.ts";

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
function renderLink(link: Link): string {
  return `<a ${LINK_ATTRIBUTES} href="${link.url}">${link.label}</a>`;
}

/** The intro paragraph, when there is one. */
function renderIntro(intro: string): string[] {
  if (!intro) return [];
  return [paragraph(intro)];
}

function renderBullets(bullets: string[]): string[] {
  return bullets.map((bullet) => paragraph(`${BULLET}${bullet}`));
}

/** The bold-labelled tech stack, when there is one. */
function renderTechStack(techStack: string): string[] {
  if (!techStack) return [];
  return [paragraph(`<strong>${TECH_STACK_LABEL}</strong> ${techStack}`)];
}

/** One `<p>` per paragraph, hard-wrapped lines joined with a space. */
function renderSummary(summary: string): string {
  return summary
    .split(PARAGRAPH_BREAK)
    .map((paragraphText) =>
      paragraphText
        .split("\n")
        .map((line) => line.trim())
        .join(" "),
    )
    .filter((paragraphText) => paragraphText.length > 0)
    .map(paragraph)
    .join("");
}

/** Intro, bullets and tech stack, then the job's references, if any. */
function renderJob(job: Job): string {
  const parts = [
    ...renderIntro(job.intro),
    ...renderBullets(job.bullets),
    ...renderTechStack(job.techStack),
  ];
  if (job.references?.length) {
    const references = job.references.join(LIST_SEPARATOR);
    parts.push(paragraph(`<strong>${REFERENCE_LABEL}</strong> ${references}`));
  }
  return parts.join("");
}

/** Intro and tech stack, then every link past the first, if any. */
function renderProject(project: Project, extraLinks: Link[]): string {
  const parts = [
    ...renderIntro(project.intro),
    ...renderTechStack(project.techStack),
  ];
  if (extraLinks.length > 0) {
    parts.push(paragraph(extraLinks.map(renderLink).join(LINK_SEPARATOR)));
  }
  return parts.join("");
}

/** The credential ids, or nothing when there are none. */
function renderCredentials(credentialIds: string[]): string {
  if (credentialIds.length === 0) return "";
  return paragraph(
    `${CREDENTIAL_ID_LABEL} ${credentialIds.join(LIST_SEPARATOR)}`,
  );
}

// ─── Items ────────────────────────────────────────────────────────────────────

function toWebsite(url: string, label: string): Website {
  return { url, label, inlineLink: false };
}

const emptyWebsite = (): Website => toWebsite("", "");

/** The header details; a bare website gets `https://` and keeps its text. */
function toBasics(header: Header, current: Basics, newId: IdFactory): Basics {
  const { name, headline, email, phone, location, website } = header;
  return {
    ...current,
    name,
    headline,
    email,
    phone,
    location,
    website: toBasicsWebsite(website),
    customFields: header.profiles.map((link) => toCustomField(link, newId())),
  };
}

function toBasicsWebsite(website: string): Basics["website"] {
  if (!website || PROTOCOL_REGEX.test(website)) {
    return { url: website, label: "" };
  }
  return { url: `${DEFAULT_PROTOCOL}${website}`, label: website };
}

/** A header link, shown next to the contact details with its network icon. */
function toCustomField(link: Link, id: string): BasicsCustomField {
  return {
    id,
    icon: NetworkIcon[link.label.toLowerCase()] ?? DEFAULT_LINK_ICON,
    text: link.label,
    link: link.url,
  };
}

function toExperienceItem(job: Job, id: string): ExperienceItem {
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

function toSkillItem(group: SkillGroup, id: string): SkillItem {
  return {
    id,
    hidden: false,
    icon: "",
    iconColor: "",
    proficiency: "",
    level: 0,
    name: group.label,
    keywords: [...group.skills],
  };
}

function toEducationItem(school: School, id: string): EducationItem {
  return {
    id,
    hidden: false,
    website: emptyWebsite(),
    school: school.school,
    degree: school.degree,
    area: school.area,
    grade: school.grade,
    location: school.location,
    period: school.period,
    description: [
      ...renderIntro(school.intro),
      ...renderBullets(school.bullets),
    ].join(""),
  };
}

/**
 * The API holds one website per project, so the first link becomes it and
 * the rest are appended to the description.
 */
function toProjectItem(project: Project, id: string): ProjectItem {
  const [firstLink, ...otherLinks] = project.links;
  let website = emptyWebsite();
  if (firstLink) website = toWebsite(firstLink.url, firstLink.label);

  return {
    id,
    hidden: false,
    period: "",
    name: project.title,
    description: renderProject(project, otherLinks),
    website,
  };
}

/**
 * The description paragraph, then the credential ids; the entry's link, when
 * there is one, becomes the website.
 */
function toCertificationItem(
  certification: Certification,
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
      ...renderIntro(certification.description),
      renderCredentials(certification.credentialIds),
    ].join(""),
  };
}

function toLanguageItem(language: Language, id: string): LanguageItem {
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
 * Writes what Resume.md says into a resume's data, returning new data.
 *
 * Sets the basics (the header links become custom fields) and the summary,
 * and replaces the items of every section Resume.md feeds, each with a fresh
 * id.
 *
 * @param data - The resume's current data, from `GET /resumes/{id}`.
 * @param resumeMd - What Resume.md says, from `parseResumeMd`.
 * @param newId - Called once per item.
 * @returns Data ready to send as the `data` of `PUT /resumes/{id}`.
 *
 * @example
 * applyResumeMd(current.data, parseResumeMd(markdown), randomUUID);
 */
export function applyResumeMd(
  data: ResumeData,
  resumeMd: ResumeMd,
  newId: IdFactory,
): ResumeData {
  /** Replaces a section's items with one per Resume.md entry, each with a fresh id. */
  function withItems<TSection extends { items: unknown[] }, TEntry>(
    section: TSection,
    entries: TEntry[],
    toItem: (entry: TEntry, id: string) => TSection["items"][number],
  ): TSection {
    return {
      ...section,
      items: entries.map((entry) => toItem(entry, newId())),
    };
  }

  const { sections } = data;
  return {
    ...data,
    basics: toBasics(resumeMd.header, data.basics, newId),
    summary: { ...data.summary, content: renderSummary(resumeMd.summary) },
    sections: {
      ...sections,
      experience: withItems(
        sections.experience,
        resumeMd.jobs,
        toExperienceItem,
      ),
      skills: withItems(sections.skills, resumeMd.skillGroups, toSkillItem),
      education: withItems(
        sections.education,
        resumeMd.schools,
        toEducationItem,
      ),
      projects: withItems(sections.projects, resumeMd.projects, toProjectItem),
      certifications: withItems(
        sections.certifications,
        resumeMd.certifications,
        toCertificationItem,
      ),
      languages: withItems(
        sections.languages,
        resumeMd.languages,
        toLanguageItem,
      ),
      interests: withItems(
        sections.interests,
        resumeMd.interests,
        toInterestItem,
      ),
      references: withItems(
        sections.references,
        resumeMd.references,
        toReferenceItem,
      ),
    },
  };
}
