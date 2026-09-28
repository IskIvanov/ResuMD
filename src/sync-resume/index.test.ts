import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import type { CvData } from './types.ts'
import { parseResume } from './parser.ts'
import { merge } from './merger.ts'
import { patchResumeJson } from './render-json.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

describe('sync-resume smoke test', () => {
  it('parses Resume.md without throwing', () => {
    const resumeRaw = readFileSync(resolve(ROOT, 'resume/Resume.md'), 'utf-8')
    expect(() => parseResume(resumeRaw)).not.toThrow()
  })

  it('produces no undefined on key fields after merge', () => {
    const resumeRaw = readFileSync(resolve(ROOT, 'resume/Resume.md'), 'utf-8')
    const cvRaw = readFileSync(resolve(ROOT, 'src/content/cv/en.md'), 'utf-8')

    const match = cvRaw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    expect(match).not.toBeNull()

    const cvData = yaml.load(match![1]) as CvData
    const parsed = parseResume(resumeRaw)
    const summary = merge(cvData, parsed)

    expect(summary).toBeTruthy()
    expect(cvData.experience.items.length).toBeGreaterThan(0)
    cvData.experience.items.forEach((job) => {
      expect(job.company).toBeTruthy()
      expect(Array.isArray(job.bullets)).toBe(true)
      expect(typeof job.stack).toBe('string')
    })
    expect(cvData.skillGroups.length).toBeGreaterThan(0)
    expect(cvData.education.items.length).toBeGreaterThan(0)
  })

  it('preserves experience item count after merge', () => {
    const resumeRaw = readFileSync(resolve(ROOT, 'resume/Resume.md'), 'utf-8')
    const cvRaw = readFileSync(resolve(ROOT, 'src/content/cv/en.md'), 'utf-8')
    const match = cvRaw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!
    const cvData = yaml.load(match[1]) as CvData
    const countBefore = cvData.experience.items.length

    merge(cvData, parseResume(resumeRaw))

    expect(cvData.experience.items.length).toBe(countBefore)
  })

  it('patches Resume.json from merged cv data, preserving structure', () => {
    const resumeRaw = readFileSync(resolve(ROOT, 'resume/Resume.md'), 'utf-8')
    const cvRaw = readFileSync(resolve(ROOT, 'src/content/cv/en.md'), 'utf-8')
    const jsonRaw = readFileSync(
      resolve(ROOT, 'resume/RxResume/Resume.json'),
      'utf-8'
    )
    const match = cvRaw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!
    const cvData = yaml.load(match[1]) as CvData
    merge(cvData, parseResume(resumeRaw))

    const before = JSON.parse(jsonRaw)
    const patched = patchResumeJson(cvData, JSON.parse(jsonRaw)) as typeof before

    expect(Object.keys(patched)).toEqual(Object.keys(before))
    for (const key of Object.keys(before.sections)) {
      expect(patched.sections[key].items?.length).toBe(
        before.sections[key].items?.length
      )
    }
    expect(patched.summary.content).toBe(`<p>${cvData.header.tagline}</p>`)
  })
})
