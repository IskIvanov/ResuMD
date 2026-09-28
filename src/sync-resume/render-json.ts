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
} from './types.ts'

// ─── HTML renderers ───────────────────────────────────────────────────────────

export function renderExperienceDescriptionHtml(item: ExperienceItem): string {
  const parts: string[] = []

  if (item.context) {
    parts.push(`<p>${item.context}</p>`)
  }

  for (const b of item.bullets) {
    parts.push(`<p>• ${b}</p>`)
  }

  parts.push(`<p><strong>Tech Stack:</strong> ${item.stack}</p>`)

  return parts.join('')
}

export function renderEducationDescriptionHtml(item: EducationItem): string {
  const parts: string[] = []

  if (item.context) {
    parts.push(`<p>${item.context}</p>`)
  }

  for (const b of item.bullets) {
    if (b.href && b.linkText) {
      parts.push(
        `<p>• <a target="_blank" rel="noopener noreferrer nofollow" href="${b.href}">${b.linkText}</a> ${b.text}</p>`
      )
    } else {
      parts.push(`<p>• ${b.text}</p>`)
    }
  }

  return parts.join('')
}

export function renderProjectDescriptionHtml(item: ProjectItem): string {
  return `<p>${item.context}</p><p><strong>Tech Stack:</strong> ${item.stack}</p>`
}

export function renderCertDescriptionHtml(item: CertificationItem): string {
  if (item.credentials.length === 0) return ''
  const ids = item.credentials.map((c) => c.id).join(', ')
  return `<p>Credential ID: ${ids}</p>`
}

// ─── Internal JSON shape ──────────────────────────────────────────────────────
//
// Only the fields that patchResumeJson reads or writes are typed here.
// Everything else is carried through as `unknown` so no structural field is
// accidentally dropped.

interface ExperienceJsonItem {
  company: string
  position: string
  location: string
  period: string
  description: string
  [key: string]: unknown
}

interface SkillJsonItem {
  name: string
  keywords: string[]
  [key: string]: unknown
}

interface EducationJsonItem {
  school: string
  description: string
  [key: string]: unknown
}

interface ProjectJsonItem {
  name: string
  description: string
  [key: string]: unknown
}

interface CertJsonItem {
  title: string
  issuer: string
  description: string
  [key: string]: unknown
}

interface LanguageJsonItem {
  language: string
  fluency: string
  [key: string]: unknown
}

interface InterestJsonItem {
  name: string
  [key: string]: unknown
}

interface ResumeJson {
  summary: { content: string; [key: string]: unknown }
  sections: {
    experience: { items: ExperienceJsonItem[] }
    skills: { items: SkillJsonItem[] }
    education: { items: EducationJsonItem[] }
    projects: { items: ProjectJsonItem[] }
    certifications: { items: CertJsonItem[] }
    languages: { items: LanguageJsonItem[] }
    interests: { items: InterestJsonItem[] }
  }
  [key: string]: unknown
}

// ─── Patcher ──────────────────────────────────────────────────────────────────

/**
 * Applies text from `cv` onto a deep-cloned copy of `json`, returning the
 * updated object. Only text-bearing fields defined in content.config.ts are
 * touched; all structural and metadata fields are preserved as-is.
 */
export function patchResumeJson(cv: CvData, json: unknown): unknown {
  const resume = json as ResumeJson
  const { sections } = resume

  // Summary — sync tagline from header
  resume.summary.content = `<p>${cv.header.tagline}</p>`

  // Experience — match by company name
  for (const jsonItem of sections.experience.items) {
    const cvItem = cv.experience.items.find(
      (e) => e.company === jsonItem.company
    )
    if (!cvItem) continue
    jsonItem.position = cvItem.role
    jsonItem.location = cvItem.location
    jsonItem.period = cvItem.dates
    jsonItem.description = renderExperienceDescriptionHtml(cvItem)
  }

  // Skills — match by name (JSON) === heading (en.md)
  for (const jsonItem of sections.skills.items) {
    const cvGroup = cv.skillGroups.find(
      (group) => group.heading === jsonItem.name
    )
    if (!cvGroup) continue
    jsonItem.keywords = [...cvGroup.items]
  }

  // Education — match by school name
  for (const jsonItem of sections.education.items) {
    const cvItem = cv.education.items.find((e) => e.school === jsonItem.school)
    if (!cvItem) continue
    jsonItem.description = renderEducationDescriptionHtml(cvItem)
  }

  // Projects — match by name (JSON) === title (en.md)
  for (const jsonItem of sections.projects.items) {
    const cvItem = cv.projects.items.find((p) => p.title === jsonItem.name)
    if (!cvItem) continue
    jsonItem.name = cvItem.title
    jsonItem.description = renderProjectDescriptionHtml(cvItem)
  }

  // Certifications — match by title
  for (const jsonItem of sections.certifications.items) {
    const cvItem = cv.certifications.items.find(
      (c) => c.title === jsonItem.title
    )
    if (!cvItem) continue
    jsonItem.issuer = cvItem.issuer
    jsonItem.description = renderCertDescriptionHtml(cvItem)
  }

  // Languages — match by the name portion before " — "
  for (const jsonItem of sections.languages.items) {
    const cvLang = cv.footer.languages.items.find((l) => {
      const [name] = l.split(' — ')
      return name.trim() === jsonItem.language
    })
    if (!cvLang) continue
    const [, fluency] = cvLang.split(' — ')
    if (fluency) jsonItem.fluency = fluency.trim()
  }

  // Interests — replace names positionally from the dot-separated text
  const interestNames = cv.footer.interests.text
    .split(' · ')
    .map((s) => s.trim())
  sections.interests.items.forEach((jsonItem, i) => {
    if (i < interestNames.length) {
      jsonItem.name = interestNames[i]
    }
  })

  return resume
}
