/**
 * parser.ts
 *
 * Pure functions that parse a Resume.md string into structured data.
 * No file I/O — all functions accept a raw markdown string and return data.
 *
 * Run via: bun run resume:sync
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedJob {
  company: string
  bullets: string[]
  stack: string
}

export interface ParsedSkillGroup {
  heading: string
  items: string[]
}

export interface ParsedEduItem {
  school: string
  context: string
  bullets: string[]
}

export interface ParsedResume {
  summary: string
  jobs: ParsedJob[]
  skillGroups: ParsedSkillGroup[]
  eduItems: ParsedEduItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Splits a Resume.md string into a map of `## Heading` → body.
 * Prepends a newline so the first heading is always found by /\n## /.
 */
function splitSections(md: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const parts = ('\n' + md).split(/\n## /)
  for (const part of parts.slice(1)) {
    const newlineIdx = part.indexOf('\n')
    const heading = part.slice(0, newlineIdx).trim()
    const body = part.slice(newlineIdx + 1)
    sections[heading] = body
  }
  return sections
}

/**
 * Extracts the name from a `### Name — Location` heading line.
 * Returns text before ' — ', or the full line if no ' — ' is present.
 */
function extractName(headingLine: string): string {
  const dashIdx = headingLine.indexOf(' — ')
  return dashIdx >= 0
    ? headingLine.slice(0, dashIdx).trim()
    : headingLine.trim()
}

// ─── Section parsers ──────────────────────────────────────────────────────────

/**
 * Extracts the summary paragraph from a Resume.md string.
 * Throws if the `## Summary` section is missing.
 */
export function parseSummary(md: string): string {
  const sections = splitSections(md)
  const body = sections['Summary']
  if (!body) throw new Error('Missing ## Summary section in Resume.md')
  return body.split(/\n---/)[0].trim()
}

/**
 * Extracts all experience items from a Resume.md string.
 * Each `### Company — Location` block becomes one ParsedJob.
 */
export function parseExperience(md: string): ParsedJob[] {
  const sections = splitSections(md)
  const body = sections['Experience']
  if (!body) return []

  const jobBlocks = body.split(/\n### /).filter((b) => b.trim().length > 0)

  return jobBlocks.map((block) => {
    const lines = block.split('\n')
    const company = extractName(lines[0])

    const bullets = lines
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())

    const stackLine = lines.find((l) => l.startsWith('**Tech Stack:**'))
    const stack = stackLine
      ? stackLine.replace('**Tech Stack:** ', '').trim()
      : ''

    return { company, bullets, stack }
  })
}

/**
 * Extracts all skill groups from a Resume.md string.
 * Each `**Heading:** item1, item2` line becomes one ParsedSkillGroup.
 */
export function parseSkills(md: string): ParsedSkillGroup[] {
  const sections = splitSections(md)
  const body = sections['Technical Skills']
  if (!body) return []

  const groups: ParsedSkillGroup[] = []
  const regex = /^\*\*(.+?):\*\* (.+)$/gm
  let match

  while ((match = regex.exec(body)) !== null) {
    groups.push({
      heading: match[1].trim(),
      items: match[2]
        .split(', ')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return groups
}

/**
 * Extracts all education items from a Resume.md string.
 * Each `### School` block becomes one ParsedEduItem.
 */
export function parseEducation(md: string): ParsedEduItem[] {
  const sections = splitSections(md)
  const body = sections['Education']
  if (!body) return []

  const eduBlocks = body.split(/\n### /).filter((b) => b.trim().length > 0)

  return eduBlocks.map((block) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== '---')

    const school = extractName(lines[0])

    const bullets = lines
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())

    // Context: non-bullet, non-heading line that immediately follows the degree line
    const degreeIdx = lines.findIndex(
      (l) => l.startsWith('**') && l.includes('** | ')
    )
    let context = ''
    if (degreeIdx >= 0) {
      for (let i = degreeIdx + 1; i < lines.length; i++) {
        const l = lines[i]
        if (l.startsWith('- ')) break
        if (!l.startsWith('**') && !l.startsWith('#')) {
          context = l
          break
        }
      }
    }

    return { school, context, bullets }
  })
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parses a full Resume.md string into a structured ParsedResume object.
 * Throws if the `## Summary` section is missing.
 */
export function parseResume(md: string): ParsedResume {
  return {
    summary: parseSummary(md),
    jobs: parseExperience(md),
    skillGroups: parseSkills(md),
    eduItems: parseEducation(md),
  }
}
