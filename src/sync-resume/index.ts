/**
 * sync-resume/index.ts
 *
 * Reads Resume.md, parses it via parser.ts, merges text-only changes into
 * src/content/cv/en.md via merger.ts, and writes the updated file.
 *
 * Metadata-only fields in en.md (href, datetime, icon, credential IDs, etc.)
 * are never touched. On first run, en.md is reformatted by yaml.dump() —
 * this is intentional since the file becomes machine-maintained.
 *
 * Run: yarn resume:sync
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import type { CvData } from '../generate-resume/types.ts'
import { parseResume } from './parser.ts'
import { merge } from './merger.ts'

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const RESUME_PATH = resolve(ROOT, 'Resume.md')
const CV_PATH = resolve(ROOT, 'src/content/cv/en.md')

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Splits a file with YAML frontmatter into its data and body components.
 * Throws if frontmatter delimiters are not found.
 */
function parseFrontmatter(raw: string): { data: CvData; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`No YAML frontmatter found in ${CV_PATH}`)
  return {
    data: yaml.load(match[1]) as CvData,
    body: match[2].trim(),
  }
}

/**
 * Serializes CvData and a summary body back into a frontmatter file string.
 * Note: yaml.dump() reformats the YAML on first run — this is intentional.
 */
function serializeCv(data: CvData, body: string): string {
  const frontmatter = yaml.dump(data, {
    lineWidth: -1,
    quotingType: "'",
    noRefs: true,
  })
  return `---\n${frontmatter}---\n\n${body}\n`
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const resumeRaw = readFileSync(RESUME_PATH, 'utf-8')
const cvRaw = readFileSync(CV_PATH, 'utf-8')

const { data: cvData } = parseFrontmatter(cvRaw)
const parsed = parseResume(resumeRaw)
const summary = merge(cvData, parsed)

writeFileSync(CV_PATH, serializeCv(cvData, summary), 'utf-8')
console.log(`✓ src/content/cv/en.md synced from Resume.md`)
