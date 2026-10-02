/**
 * render-json.ts
 *
 * HTML renderers for each Resume.json description field, plus a patcher that
 * applies CvData text onto an existing JSON object — touching only text fields
 * and preserving all structural/metadata fields (ids, hidden flags, urls, etc.).
 */

import type {
  CertificationItem,
  CvData,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeJson,
} from "./types.ts";

// ─── HTML renderers ───────────────────────────────────────────────────────────

/**
 * Renders an external link that opens in a new tab.
 *
 * @param label - The link text.
 * @param href - The URL to link to.
 * @returns An `<a>` element.
 */
export function renderLinkHtml(label: string, href: string): string {
  return `<a target="_blank" rel="noopener noreferrer nofollow" href="${href}">${label}</a>`;
}

function renderTechStackHtml(stack: string): string {
  return `<p><strong>Tech Stack:</strong> ${stack}</p>`;
}

export function renderExperienceDescriptionHtml(
  item: Pick<ExperienceItem, "context" | "bullets" | "stack">,
): string {
  const parts: string[] = [];

  if (item.context) {
    parts.push(`<p>${item.context}</p>`);
  }

  for (const b of item.bullets) {
    parts.push(`<p>• ${b}</p>`);
  }

  if (item.stack) {
    parts.push(renderTechStackHtml(item.stack));
  }

  return parts.join("");
}

export function renderEducationDescriptionHtml(
  item: Pick<EducationItem, "context" | "bullets">,
): string {
  const parts: string[] = [];

  if (item.context) {
    parts.push(`<p>${item.context}</p>`);
  }

  for (const b of item.bullets) {
    if (b.href && b.linkText) {
      parts.push(`<p>• ${renderLinkHtml(b.linkText, b.href)} ${b.text}</p>`);
    } else {
      parts.push(`<p>• ${b.text}</p>`);
    }
  }

  return parts.join("");
}

export function renderProjectDescriptionHtml(
  item: Pick<ProjectItem, "context" | "stack">,
): string {
  const parts: string[] = [];

  if (item.context) {
    parts.push(`<p>${item.context}</p>`);
  }

  if (item.stack) {
    parts.push(renderTechStackHtml(item.stack));
  }

  return parts.join("");
}

export function renderCertDescriptionHtml(item: CertificationItem): string {
  const credentials = item.credentials ?? [];
  if (credentials.length === 0) return "";
  const ids = credentials.map((c) => c.id).join(", ");
  return `<p>Credential ID: ${ids}</p>`;
}

// ─── Patcher ──────────────────────────────────────────────────────────────────

/**
 * Applies text from `cv` onto a deep-cloned copy of `json`, returning the
 * updated object. Only text-bearing fields defined in content.config.ts are
 * touched; all structural and metadata fields are preserved as-is.
 */
export function patchResumeJson(cv: CvData, json: unknown): unknown {
  const resume = json as ResumeJson;
  const { sections } = resume;

  // Summary — sync tagline from header
  resume.summary.content = `<p>${cv.header.tagline}</p>`;

  // Experience — match by company name
  for (const jsonItem of sections.experience.items) {
    const cvItem = cv.experience.items.find(
      (e) => e.company === jsonItem.company,
    );
    if (!cvItem) continue;
    jsonItem.position = cvItem.role;
    jsonItem.location = cvItem.location;
    jsonItem.period = cvItem.dates;
    jsonItem.description = renderExperienceDescriptionHtml(cvItem);
  }

  // Skills — match by name (JSON) === heading (en.md)
  for (const jsonItem of sections.skills.items) {
    const cvGroup = cv.skillGroups.find(
      (group) => group.heading === jsonItem.name,
    );
    if (!cvGroup) continue;
    jsonItem.keywords = [...cvGroup.items];
  }

  // Education — match by school name
  for (const jsonItem of sections.education.items) {
    const cvItem = cv.education.items.find((e) => e.school === jsonItem.school);
    if (!cvItem) continue;
    jsonItem.description = renderEducationDescriptionHtml(cvItem);
  }

  // Projects — match by name (JSON) === title (en.md)
  for (const jsonItem of sections.projects.items) {
    const cvItem = cv.projects.items.find((p) => p.title === jsonItem.name);
    if (!cvItem) continue;
    jsonItem.name = cvItem.title;
    jsonItem.description = renderProjectDescriptionHtml(cvItem);
  }

  // Certifications — match by title
  for (const jsonItem of sections.certifications.items) {
    const cvItem = cv.certifications.items.find(
      (c) => c.title === jsonItem.title,
    );
    if (!cvItem) continue;
    jsonItem.issuer = cvItem.issuer;
    jsonItem.description = renderCertDescriptionHtml(cvItem);
  }

  // Languages — match by the name portion before " — "
  for (const jsonItem of sections.languages.items) {
    const cvLang = cv.footer.languages.items.find((l) => {
      const [name] = l.split(" — ");
      return name.trim() === jsonItem.language;
    });
    if (!cvLang) continue;
    const [, fluency] = cvLang.split(" — ");
    if (fluency) jsonItem.fluency = fluency.trim();
  }

  // Interests — replace names positionally from the dot-separated text
  const interestNames = cv.footer.interests.text
    .split(" · ")
    .map((s) => s.trim());
  sections.interests.items.forEach((jsonItem, i) => {
    if (i < interestNames.length) {
      jsonItem.name = interestNames[i];
    }
  });

  return resume;
}
