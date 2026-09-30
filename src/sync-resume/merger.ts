/**
 * merger.ts
 *
 * Pure functions that merge a ParsedResume into an existing CvData object.
 * Mutates cv in place. No file I/O.
 *
 * Match strategy: exact string equality on company, heading, or school name.
 * On no match: console.warn + skip (never throw).
 */

import type {
  CvData,
  EducationBullet,
  ParsedEduItem,
  ParsedJob,
  ParsedResume,
  ParsedSkillGroup,
} from "./types.ts";

// ─── Experience ───────────────────────────────────────────────────────────────

/**
 * Updates role, bullets and stack for each matched experience item.
 * Match key: company name. Unmatched jobs emit a warning and are skipped.
 * An empty parsed role (no `**Role** | dates` line) keeps the existing role.
 */
export function mergeExperience(
  cv: CvData,
  jobs: Pick<ParsedJob, "company" | "role" | "bullets" | "stack">[],
): void {
  for (const parsed of jobs) {
    const cvJob = cv.experience.items.find(
      (item) => item.company === parsed.company,
    );
    if (!cvJob) {
      console.warn(
        `sync-resume: no experience match for company "${parsed.company}" — skipping`,
      );
      continue;
    }
    if (parsed.role) {
      cvJob.role = parsed.role;
    }
    cvJob.bullets = parsed.bullets;
    cvJob.stack = parsed.stack;
  }
}

// ─── Skills ───────────────────────────────────────────────────────────────────

/**
 * Updates items for each matched skill group.
 * Match key: heading text. Unmatched groups emit a warning and are skipped.
 */
export function mergeSkills(cv: CvData, groups: ParsedSkillGroup[]): void {
  for (const parsed of groups) {
    const cvGroup = cv.skillGroups.find((g) => g.heading === parsed.heading);
    if (!cvGroup) {
      console.warn(
        `sync-resume: no skill group match for heading "${parsed.heading}" — skipping`,
      );
      continue;
    }
    cvGroup.items = parsed.items;
  }
}

// ─── Education ────────────────────────────────────────────────────────────────

/**
 * Updates context and bullet text for each matched education item.
 * Match key: school name. Unmatched items emit a warning and are skipped.
 *
 * Bullet strategy per bullet:
 * - Has linkText: strip linkText prefix from parsed line, update text only.
 *   linkText and href are preserved.
 * - No linkText: replace text directly.
 * - Count mismatch: warn and update overlapping indices only.
 */
export function mergeEducation(
  cv: CvData,
  eduItems: Pick<ParsedEduItem, "school" | "context" | "bullets">[],
): void {
  for (const parsed of eduItems) {
    const cvEdu = cv.education.items.find((e) => e.school === parsed.school);
    if (!cvEdu) {
      console.warn(
        `sync-resume: no education match for school "${parsed.school}" — skipping`,
      );
      continue;
    }

    if (parsed.context) {
      cvEdu.context = parsed.context;
    }

    if (parsed.bullets.length !== cvEdu.bullets.length) {
      console.warn(
        `sync-resume: bullet count mismatch for "${parsed.school}": ` +
          `Resume.md has ${parsed.bullets.length}, en.md has ${cvEdu.bullets.length} — ` +
          `updating overlapping indices only`,
      );
    }

    const count = Math.min(parsed.bullets.length, cvEdu.bullets.length);
    for (let i = 0; i < count; i++) {
      const parsedLine = parsed.bullets[i];
      const cvBullet = cvEdu.bullets[i] as EducationBullet;

      if (cvBullet.linkText) {
        const prefix = cvBullet.linkText + " ";
        cvBullet.text = parsedLine.startsWith(prefix)
          ? parsedLine.slice(prefix.length)
          : parsedLine;
      } else {
        cvBullet.text = parsedLine;
      }
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Merges all parsed sections into cv (mutates in place).
 * Returns the new summary body string for writing to the en.md body.
 */
export function merge(
  cv: CvData,
  parsed: Pick<ParsedResume, "summary" | "jobs" | "skillGroups" | "eduItems">,
): string {
  mergeExperience(cv, parsed.jobs);
  mergeSkills(cv, parsed.skillGroups);
  mergeEducation(cv, parsed.eduItems);
  return parsed.summary;
}
