/**
 * Renderers — one pure function per CV section.
 *
 * Each function takes only the data it needs and returns a markdown string.
 * Adding a new section = add a new exported function here, then wire it in
 * compose() inside index.ts. No existing code needs to change.
 */

import type {
  CertificationItem,
  ContactItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SkillGroup,
} from './types.ts'

const DIVIDER = '---'

// ─── Header ──────────────────────────────────────────────────────────────────

export function renderHeader(name: string, title: string): string {
  return [`# ${name}`, '', `**${title}**`].join('\n')
}

// ─── Contact ─────────────────────────────────────────────────────────────────

export function renderContact(items: ContactItem[]): string {
  // Split items into two rows: core details (email, location, website) then
  // social links (everything with target="_blank"), matching the Resume.md layout.
  const core = items
    .filter((item) => !item.target)
    .map((item) => item.label)
    .join(' | ')

  const social = items
    .filter((item) => item.target === '_blank')
    .map((item) => item.label)
    .join(' | ')

  return [core, social].filter(Boolean).join('\n')
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function renderSummary(body: string): string {
  return [`## Summary`, '', body.trim()].join('\n')
}

// ─── Experience ──────────────────────────────────────────────────────────────

export function renderExperienceItem(job: ExperienceItem): string {
  const lines: string[] = [
    `### ${job.company} — ${job.location}`,
    '',
    `**${job.role}** | ${job.dates}`,
  ]

  if (job.context) {
    lines.push('', job.context)
  }

  lines.push('')
  job.bullets.forEach((bullet) => lines.push(`- ${bullet}`, ''))

  lines.push(`**Tech Stack:** ${job.stack}`)

  return lines.join('\n')
}

export function renderExperience(items: ExperienceItem[]): string {
  return [
    '## Experience',
    '',
    items.map(renderExperienceItem).join(`\n\n${DIVIDER}\n\n`),
  ].join('\n')
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export function renderSkillGroup(group: SkillGroup): string {
  return `**${group.heading}:** ${group.items.join(', ')}`
}

export function renderSkills(groups: SkillGroup[]): string {
  return [
    '## Technical Skills',
    '',
    groups.map(renderSkillGroup).join('\n\n'),
  ].join('\n')
}

// ─── Education ───────────────────────────────────────────────────────────────

export function renderEducationItem(edu: EducationItem): string {
  const heading = edu.location
    ? `### ${edu.school} — ${edu.location}`
    : `### ${edu.school}`

  const lines: string[] = [heading, '', `**${edu.degree}** | ${edu.dates}`]

  if (edu.context) {
    lines.push('', edu.context)
  }

  const bulletLines = edu.bullets.map((b) => {
    // Render linked bullets as plain text (Resume.md is a document, not a webpage)
    const prefix = b.linkText ? `${b.linkText} ` : ''
    return `- ${prefix}${b.text}`
  })

  if (bulletLines.length) {
    lines.push('', ...bulletLines)
  }

  return lines.join('\n')
}

export function renderEducation(items: EducationItem[]): string {
  return ['## Education', '', items.map(renderEducationItem).join('\n\n')].join(
    '\n'
  )
}

// ─── Projects ────────────────────────────────────────────────────────────────

export function renderProjectItem(project: ProjectItem): string {
  const lines: string[] = [
    `### ${project.title}`,
    '',
    project.context,
    '',
    `**Tech Stack:** ${project.stack}`,
  ]

  if (project.links.length) {
    lines.push('', project.links.map((l) => l.label).join(' | '))
  }

  return lines.join('\n')
}

export function renderProjects(items: ProjectItem[]): string {
  return ['## Projects', '', items.map(renderProjectItem).join('\n\n')].join(
    '\n'
  )
}

// ─── Certifications ──────────────────────────────────────────────────────────

export function renderCertificationItem(cert: CertificationItem): string {
  const credentialIds = cert.credentials.map((c) => c.id).join(', ')
  return [
    `**${cert.title}**`,
    '',
    cert.issuer,
    credentialIds ? `Credential ID: ${credentialIds}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function renderCertifications(items: CertificationItem[]): string {
  return [
    '## Certifications',
    '',
    items.map(renderCertificationItem).join('\n\n'),
  ].join('\n')
}

// ─── Footer ──────────────────────────────────────────────────────────────────

export function renderLanguages(items: string[]): string {
  return ['## Languages', '', items.map((lang) => `- ${lang}`).join('\n')].join(
    '\n'
  )
}

export function renderInterests(text: string): string {
  return ['## Interests', '', text].join('\n')
}

export function renderReferences(text: string): string {
  return text
}
