/**
 * resume-data.ts
 *
 * Pure functions that map a ParsedResume onto the Reactive Resume `data`
 * shape used by `PUT /resumes/{id}`. Only keys Resume.md can fill are set;
 * ids, visibility, layout and links are left to the resume being updated.
 */

import type {
  ParsedContact,
  ParsedCertification,
  ParsedEduItem,
  ParsedJob,
  ParsedLanguage,
  ParsedLink,
  ParsedProject,
  ParsedResume,
  ParsedSkillGroup,
} from "../sync-resume/types.ts";
import {
  renderCertDescriptionHtml,
  renderEducationDescriptionHtml,
  renderExperienceDescriptionHtml,
  renderLinkHtml,
  renderProjectDescriptionHtml,
} from "../sync-resume/render-json.ts";
import type {
  ParsedBasicsData,
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
} from "./types.ts";

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
/** Separates the extra project links appended to a description. */
const LINK_SEPARATOR = " | ";
/** Labels the bold line of references under a job. */
const REFERENCE_LABEL = "Reference:";
const REFERENCE_SEPARATOR = ", ";

// ─── Basics and summary ───────────────────────────────────────────────────────

/**
 * Maps a header link onto a Reactive Resume custom field, which the templates
 * show in the resume header next to the contact details.
 *
 * @param link - A markdown link parsed from the Resume.md header.
 * @returns The label as the field's text, the URL as its link, and the
 *   network's icon (a generic link icon when unknown).
 *
 * @example
 * toCustomField({ label: "GitHub", url: "https://github.com/jane" });
 * // { icon: "github-logo", text: "GitHub", link: "https://github.com/jane" }
 */
export function toCustomField(link: ParsedLink): ParsedCustomField {
  return {
    icon: NetworkIcon[link.label.toLowerCase()] ?? DEFAULT_LINK_ICON,
    text: link.label,
    link: link.url,
  };
}

/**
 * Maps the parsed personal details onto the Reactive Resume basics.
 *
 * @param basics - The header details parsed from Resume.md.
 * @returns The basics, with the header links as custom fields. A bare website
 *   such as `example.com` gets an `https://` URL and keeps its text as the
 *   label.
 *
 * @example
 * toBasics({ ...details, website: "example.com" }).website;
 * // { url: "https://example.com", label: "example.com" }
 */
export function toBasics(basics: ParsedContact): ParsedBasicsData {
  const { name, headline, email, phone, location, website } = basics;
  const hasProtocol = PROTOCOL_REGEX.test(website);

  return {
    name,
    headline,
    email,
    phone,
    location,
    website: {
      url: website && !hasProtocol ? `${DEFAULT_PROTOCOL}${website}` : website,
      label: hasProtocol ? "" : website,
    },
    customFields: basics.profiles.map(toCustomField),
  };
}

/**
 * Renders the Resume.md summary as HTML paragraphs.
 *
 * @param summary - Raw summary text; blank lines separate paragraphs and
 *   hard-wrapped lines within a paragraph are joined with a space.
 * @returns One `<p>` per paragraph, or an empty string for an empty summary.
 *
 * @example
 * renderSummaryHtml("First\nline.\n\nSecond.");
 * // "<p>First line.</p><p>Second.</p>"
 */
export function renderSummaryHtml(summary: string): string {
  return summary
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((l) => l.trim())
        .join(" "),
    )
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

// ─── Section items ────────────────────────────────────────────────────────────

/**
 * Maps a parsed job onto a Reactive Resume experience item.
 *
 * @param job - A job parsed from `## Experience`.
 * @returns The company, position, location, period and HTML description
 *   (context + bullets + tech stack, then a bold `Reference: a, b` line
 *   when the job has contacts), plus the website when the job has a URL.
 */
export function toExperienceItem(job: ParsedJob): ParsedExperienceItem {
  let description = renderExperienceDescriptionHtml(job);
  if (job.references?.length) {
    const references = job.references.join(REFERENCE_SEPARATOR);
    description += `<p><strong>${REFERENCE_LABEL}</strong> ${references}</p>`;
  }

  return {
    company: job.company,
    position: job.role,
    location: job.location,
    period: job.period,
    description,
    ...(job.website && {
      website: { url: job.website, label: "", inlineLink: false },
    }),
  };
}

/**
 * Maps a parsed skill group onto a Reactive Resume skill item.
 *
 * @param group - A `**Heading:** a, b` line parsed from `## Technical Skills`.
 * @returns The group heading as `name` and a copy of its items as `keywords`.
 */
export function toSkillItem(group: ParsedSkillGroup): ParsedSkillItem {
  return {
    name: group.heading,
    keywords: [...group.items],
  };
}

/**
 * Maps a parsed education entry onto a Reactive Resume education item.
 *
 * @param edu - An entry parsed from `## Education`.
 * @returns The school, degree, area, grade, location, period and HTML
 *   description (context + bullets).
 */
export function toEducationItem(edu: ParsedEduItem): ParsedEducationItem {
  return {
    school: edu.school,
    degree: edu.degree,
    area: edu.area,
    grade: edu.grade,
    location: edu.location,
    period: edu.period,
    description: renderEducationDescriptionHtml({
      context: edu.context,
      bullets: edu.bullets.map((text) => ({ text })),
    }),
  };
}

/**
 * Maps a parsed project onto a Reactive Resume project item.
 *
 * @param project - A project parsed from `## Projects`.
 * @returns The title as `name` and the HTML description (context + tech stack).
 *   The first link becomes the website, since the API holds one per project;
 *   further links are appended to the description.
 */
export function toProjectItem(project: ParsedProject): ParsedProjectItem {
  const [primary, ...extra] = project.links;
  const extraLinks = extra
    .map((link) => renderLinkHtml(link.label, link.url))
    .join(LINK_SEPARATOR);

  return {
    name: project.title,
    description:
      renderProjectDescriptionHtml(project) +
      (extraLinks ? `<p>${extraLinks}</p>` : ""),
    ...(primary && {
      website: { url: primary.url, label: primary.label, inlineLink: false },
    }),
  };
}

/**
 * Maps a parsed certification onto a Reactive Resume certification item.
 *
 * @param certification - A line parsed from `## Certifications`.
 * @returns The title, issuer and an HTML description listing the credential
 *   ids, empty when there are none.
 */
export function toCertificationItem(
  certification: ParsedCertification,
): ParsedCertificationItem {
  return {
    title: certification.title,
    issuer: certification.issuer,
    description: renderCertDescriptionHtml({
      title: certification.title,
      issuer: certification.issuer,
      // The renderer reads only the ids; Resume.md has no credential links.
      credentials: certification.credentialIds.map((id) => ({ id, href: "" })),
    }),
  };
}

/**
 * Maps a parsed language onto a Reactive Resume language item.
 *
 * @param language - A bullet parsed from `## Languages`.
 * @returns The language, its fluency text and its 0–5 level.
 */
export function toLanguageItem(language: ParsedLanguage): ParsedLanguageItem {
  return {
    language: language.language,
    fluency: language.fluency,
    level: language.level,
  };
}

/**
 * Maps a parsed interest onto a Reactive Resume interest item.
 *
 * @param interest - One entry of the `## Interests` line.
 * @returns The interest as `name`.
 */
export function toInterestItem(interest: string): ParsedInterestItem {
  return { name: interest };
}

/**
 * Maps a parsed reference onto a Reactive Resume reference item.
 *
 * @param reference - A reference line, or a note such as
 *   "References available upon request".
 * @returns The line as `name`.
 */
export function toReferenceItem(reference: string): ParsedReferenceItem {
  return { name: reference };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Maps a full ParsedResume onto the Reactive Resume `data` paths it can fill.
 *
 * @param parsed - Output of `parseResume`.
 * @returns A partial `data` object: basics, summary content and the items of
 *   every section Resume.md has.
 *
 * @example
 * toResumeData(parseResume(md)).sections.skills.items;
 * // [{ name: "Languages", keywords: ["TypeScript", "Python"] }]
 */
export function toResumeData(parsed: ParsedResume): ParsedResumeData {
  return {
    basics: toBasics(parsed.contact),
    summary: { content: renderSummaryHtml(parsed.summary) },
    sections: {
      experience: { items: parsed.jobs.map(toExperienceItem) },
      skills: { items: parsed.skillGroups.map(toSkillItem) },
      education: { items: parsed.eduItems.map(toEducationItem) },
      projects: { items: parsed.projects.map(toProjectItem) },
      certifications: { items: parsed.certifications.map(toCertificationItem) },
      languages: { items: parsed.languages.map(toLanguageItem) },
      interests: { items: parsed.interests.map(toInterestItem) },
      references: { items: parsed.references.map(toReferenceItem) },
    },
  };
}
