/**
 * generate-resume/index.ts
 *
 * Reads src/content/cv/en.md, renders each section via renderers.ts,
 * and writes the result to Resume.md at the project root.
 *
 * Run: bun run resume:generate
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import type { CvData } from './types.ts'
import * as render from './renderers.ts'
import { patchResumeJson } from './render-json.ts'

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const SOURCE = resolve(ROOT, 'src/content/cv/en.md')
const OUTPUT = resolve(ROOT, 'Resume.md')
const JSON_OUTPUT = resolve(ROOT, 'Resume.json')

// ─── Frontmatter parser ───────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { data: CvData; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`No YAML frontmatter found in ${SOURCE}`)
  return {
    data: yaml.load(match[1]) as CvData,
    body: match[2].trim(),
  }
}

// ─── Composer ─────────────────────────────────────────────────────────────────
//
// Each entry in SECTIONS is a thunk that receives parsed cv data + the markdown
// body. To add, remove, or reorder a section — only edit this array.

type Section = (cv: CvData, body: string) => string

const SECTIONS: Section[] = [
  (cv) => render.renderHeader(cv.header.name, cv.header.title),
  (cv) => render.renderContact(cv.contact.items),
  (_cv, body) => render.renderSummary(body),
  (cv) => render.renderExperience(cv.experience.items),
  (cv) => render.renderSkills(cv.skillGroups),
  (cv) => render.renderEducation(cv.education.items),
  (cv) => render.renderProjects(cv.projects.items),
  (cv) => render.renderCertifications(cv.certifications.items),
  (cv) => render.renderLanguages(cv.footer.languages.items),
  (cv) => render.renderInterests(cv.footer.interests.text),
  (cv) => render.renderReferences(cv.footer.references),
]

function compose(cv: CvData, body: string): string {
  return SECTIONS.map((section) => section(cv, body))
    .filter(Boolean)
    .join('\n\n---\n\n')
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const raw = readFileSync(SOURCE, 'utf-8')
const { data, body } = parseFrontmatter(raw)

const output = compose(data, body)
writeFileSync(OUTPUT, output + '\n', 'utf-8')
console.log(`✓ Resume.md generated from ${SOURCE}`)

const currentJson = JSON.parse(readFileSync(JSON_OUTPUT, 'utf-8'))
const updatedJson = patchResumeJson(data, currentJson)
writeFileSync(JSON_OUTPUT, JSON.stringify(updatedJson, null, 2) + '\n', 'utf-8')
console.log(`✓ Resume.json patched from ${SOURCE}`)
