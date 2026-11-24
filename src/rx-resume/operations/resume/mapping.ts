/**
 * mapping.ts
 *
 * Writes what Resume.md says into a resume's `data`. `PUT /resumes/{id}`
 * validates every required field, so each item is built whole: the fields
 * Resume.md feeds, empty defaults for the rest and a fresh id. An item that
 * matches a stored one takes that one's id and the fields Markdown can't hold.
 * Section layout, hidden items, the sections Resume.md doesn't feed and every
 * other block (picture, metadata, …) are kept as they are.
 */

import type {
  Certification,
  Header,
  Interest,
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
const TRAILING_SLASH_REGEX = /\/$/;

/** Phosphor icons for known networks, keyed by lowercase link label. */
const NetworkIcon: Record<string, string> = {
  linkedin: "linkedin-logo",
  github: "github-logo",
  gitlab: "gitlab-logo",
  twitter: "twitter-logo",
  x: "x-logo",
};
const DEFAULT_LINK_ICON = "link";

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

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const HTML_SPECIAL_REGEX = /[&<>"]/g;
/** Matches `[label](url)`; group 1 is the label, 2 the URL. */
const INLINE_LINK_REGEX = /\[([^\]]+)\]\(((?:https?:|mailto:|tel:)[^\s)]+)\)/g;
/** Holds a link's place while the text around it is rendered. */
const ANCHOR_PLACEHOLDER_REGEX = /\0(\d+)\0/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
/** Only at word boundaries, so `snake_case_name` stays as it is. */
const ITALIC_REGEX = /(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g;
const STRIKETHROUGH_REGEX = /~~(.+?)~~/g;
/** The export keeps underline as `<u>`, escaped by now. */
const UNDERLINE_REGEX = /&lt;u&gt;(.+?)&lt;\/u&gt;/g;

// ─── HTML ─────────────────────────────────────────────────────────────────────

function paragraph(html: string): string {
  return `<p>${html}</p>`;
}

function escapeHtml(text: string): string {
  return text.replace(
    HTML_SPECIAL_REGEX,
    (special) => HTML_ENTITIES[special] ?? special,
  );
}

/** An external link that opens in a new tab. */
function renderAnchor(url: string, labelHtml: string): string {
  return `<a ${LINK_ATTRIBUTES} href="${escapeHtml(url)}">${labelHtml}</a>`;
}

function renderLink(link: Link): string {
  return renderAnchor(link.url, escapeHtml(link.label));
}

/** Escapes text and turns the export's emphasis markers into HTML. */
function renderEmphasis(text: string): string {
  return escapeHtml(text)
    .replace(BOLD_REGEX, "<strong>$1</strong>")
    .replace(ITALIC_REGEX, "<em>$1</em>")
    .replace(STRIKETHROUGH_REGEX, "<s>$1</s>")
    .replace(UNDERLINE_REGEX, "<u>$1</u>");
}

/**
 * The HTML of one line of Markdown, which is how the export writes rich text.
 * Links are set aside first, so a `_` in a URL can't start an italic.
 */
function renderInline(text: string): string {
  const anchors: string[] = [];
  const withoutLinks = text.replace(
    INLINE_LINK_REGEX,
    (_match, label: string, url: string) => {
      anchors.push(renderAnchor(url, renderEmphasis(label)));
      return `\0${anchors.length - 1}\0`;
    },
  );
  return renderEmphasis(withoutLinks).replace(
    ANCHOR_PLACEHOLDER_REGEX,
    (_match, index: string) => anchors[Number(index)] ?? "",
  );
}

/** The intro paragraph, when there is one. */
function renderIntro(intro: string): string[] {
  if (!intro) return [];
  return [paragraph(renderInline(intro))];
}

/** One real list, which the export writes back as `- ` bullets. */
function renderBullets(bullets: string[]): string[] {
  if (bullets.length === 0) return [];
  const items = bullets.map(
    (bullet) => `<li>${paragraph(renderInline(bullet))}</li>`,
  );
  return [`<ul>${items.join("")}</ul>`];
}

/** The bold-labelled tech stack, when there is one. */
function renderTechStack(techStack: string): string[] {
  if (!techStack) return [];
  return [
    paragraph(
      `<strong>${TECH_STACK_LABEL}</strong> ${renderInline(techStack)}`,
    ),
  ];
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
    .map((paragraphText) => paragraph(renderInline(paragraphText)))
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
    website: toBasicsWebsite(website, header.websiteUrl),
    customFields: header.profiles.map((link) => {
      const field = toCustomField(link, newId());
      const stored = current.customFields.find(
        (customField) => customField.text === link.label,
      );
      if (!stored) return field;
      return { ...field, id: stored.id, icon: stored.icon };
    }),
  };
}

function toBasicsWebsite(
  website: string,
  websiteUrl: string | undefined,
): Basics["website"] {
  if (websiteUrl) return { url: websiteUrl, label: website };
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
    proficiency: group.proficiency ?? "",
    level: 0,
    name: group.label,
    keywords: [...group.skills],
  };
}

function toEducationItem(school: School, id: string): EducationItem {
  let website = emptyWebsite();
  if (school.website)
    website = toWebsite(school.website.url, school.website.label);

  return {
    id,
    hidden: false,
    website,
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
    period: project.period ?? "",
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
    date: certification.date ?? "",
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

function toInterestItem(interest: Interest, id: string): InterestItem {
  const { name, keywords } = interest;
  return { id, hidden: false, icon: "", iconColor: "", keywords, name };
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

// ─── Matching stored items ────────────────────────────────────────────────────

/** How a section's new items find their stored ones. */
interface ItemMatching<TItem> {
  /** What must be equal for two items to be the same one. */
  keyOf: (item: TItem) => string;
  /** The stored fields a matched item keeps, as Markdown can't hold them. */
  keep: (stored: TItem, written: TItem) => Partial<TItem>;
}

/** True for one URL with or without its trailing slash, which the export adds. */
function isSameUrl(firstUrl: string, secondUrl: string): boolean {
  return (
    firstUrl.replace(TRAILING_SLASH_REGEX, "") ===
    secondUrl.replace(TRAILING_SLASH_REGEX, "")
  );
}

/** The stored website's URL and details, while the URL hasn't changed. */
function keepWebsite(stored: Website, written: Website): Website {
  if (!isSameUrl(stored.url, written.url)) return written;
  return {
    url: stored.url,
    label: written.label || stored.label,
    inlineLink: stored.inlineLink,
  };
}

const EXPERIENCE_MATCHING: ItemMatching<ExperienceItem> = {
  keyOf: ({ company, position }) => `${company}\n${position}`,
  keep: (stored, written) => ({
    website: keepWebsite(stored.website, written.website),
  }),
};

const SKILL_MATCHING: ItemMatching<SkillItem> = {
  keyOf: ({ name }) => name,
  keep: ({ icon, iconColor, level }) => ({ icon, iconColor, level }),
};

const EDUCATION_MATCHING: ItemMatching<EducationItem> = {
  keyOf: ({ school, degree }) => `${school}\n${degree}`,
  keep: (stored, written) => ({
    website: keepWebsite(stored.website, written.website),
  }),
};

const PROJECT_MATCHING: ItemMatching<ProjectItem> = {
  keyOf: ({ name }) => name,
  keep: (stored, written) => ({
    website: keepWebsite(stored.website, written.website),
  }),
};

const CERTIFICATION_MATCHING: ItemMatching<CertificationItem> = {
  keyOf: ({ title }) => title,
  keep: (stored, written) => ({
    website: keepWebsite(stored.website, written.website),
  }),
};

/** A level written in the file wins; 0 means the file gave none. */
const LANGUAGE_MATCHING: ItemMatching<LanguageItem> = {
  keyOf: ({ language }) => language,
  keep: (stored, written) => ({ level: written.level || stored.level }),
};

const INTEREST_MATCHING: ItemMatching<InterestItem> = {
  keyOf: ({ name }) => name,
  keep: ({ icon, iconColor }) => ({ icon, iconColor }),
};

const REFERENCE_MATCHING: ItemMatching<ReferenceItem> = {
  keyOf: ({ name }) => name,
  keep: ({ position, phone, website, description }) => ({
    position,
    phone,
    website,
    description,
  }),
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Writes what Resume.md says into a resume's data, returning new data.
 *
 * Sets the basics (the header links become custom fields) and the summary,
 * and replaces the visible items of every section Resume.md feeds, each with a
 * fresh id, or the id and unexported fields of the stored item it matches.
 * Hidden items are kept after them.
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
  /**
   * Replaces a section's visible items with one per Resume.md entry. Each
   * stored item matches at most one entry, so ids stay unique. The export
   * leaves hidden items out, so they stay, and so does a hidden section the
   * file says nothing about.
   */
  function withItems<
    TItem extends { id: string; hidden: boolean },
    TSection extends { hidden: boolean; items: TItem[] },
    TEntry,
  >(
    section: TSection,
    entries: TEntry[],
    toItem: (entry: TEntry, id: string) => TItem,
    { keyOf, keep }: ItemMatching<TItem>,
  ): TSection {
    if (section.hidden && entries.length === 0) return section;

    const unmatchedItems = section.items.filter((item) => !item.hidden);
    const items = entries.map((entry) => {
      const written = toItem(entry, newId());
      const matchIndex = unmatchedItems.findIndex(
        (stored) => keyOf(stored) === keyOf(written),
      );
      if (matchIndex < 0) return written;
      const [stored] = unmatchedItems.splice(matchIndex, 1);
      if (!stored) return written;
      return { ...written, ...keep(stored, written), id: stored.id };
    });

    return {
      ...section,
      items: [...items, ...section.items.filter((item) => item.hidden)],
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
        EXPERIENCE_MATCHING,
      ),
      skills: withItems(
        sections.skills,
        resumeMd.skillGroups,
        toSkillItem,
        SKILL_MATCHING,
      ),
      education: withItems(
        sections.education,
        resumeMd.schools,
        toEducationItem,
        EDUCATION_MATCHING,
      ),
      projects: withItems(
        sections.projects,
        resumeMd.projects,
        toProjectItem,
        PROJECT_MATCHING,
      ),
      certifications: withItems(
        sections.certifications,
        resumeMd.certifications,
        toCertificationItem,
        CERTIFICATION_MATCHING,
      ),
      languages: withItems(
        sections.languages,
        resumeMd.languages,
        toLanguageItem,
        LANGUAGE_MATCHING,
      ),
      interests: withItems(
        sections.interests,
        resumeMd.interests,
        toInterestItem,
        INTEREST_MATCHING,
      ),
      references: withItems(
        sections.references,
        resumeMd.references,
        toReferenceItem,
        REFERENCE_MATCHING,
      ),
    },
  };
}
