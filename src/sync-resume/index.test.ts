import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import type { CvData } from "./types.ts";
import { parseResume } from "./parser.ts";
import { merge } from "./merger.ts";
import { patchResumeJson } from "./render-json.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");
const TEMPLATE_PATH = resolve(
  __dirname,
  "../../resume/RxResume/Resume.template.json",
);

const read = (path: string): string => readFileSync(path, "utf-8");
const resumeRaw = read(resolve(FIXTURES, "Resume.md"));
const cvRaw = read(resolve(FIXTURES, "cv.md"));

function loadCv(): CvData {
  const match = cvRaw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  expect(match).not.toBeNull();
  return yaml.load(match![1]) as CvData;
}

describe("sync-resume smoke test", () => {
  it("parses Resume.md without throwing", () => {
    expect(() => parseResume(resumeRaw)).not.toThrow();
  });

  it("merges Resume.md text into the cv data", () => {
    const cvData = loadCv();
    const summary = merge(cvData, parseResume(resumeRaw));

    expect(summary).toMatch(/^Software engineer with a focus/);
    const [job] = cvData.experience.items;
    expect(job.role).toBe("Senior Software Engineer");
    expect(job.bullets).toHaveLength(2);
    expect(job.bullets[0]).toMatch(/cutting release time in half\.$/);
    expect(job.stack).toBe("TypeScript, React, Node.js");
    expect(cvData.skillGroups[0].items).toEqual([
      "TypeScript",
      "Python",
      "SQL",
    ]);
    expect(cvData.education.items[0].bullets[1].text).toBe(
      "Thesis: Distributed Task Scheduling",
    );
  });

  it("preserves experience item count after merge", () => {
    const cvData = loadCv();
    const countBefore = cvData.experience.items.length;

    merge(cvData, parseResume(resumeRaw));

    expect(cvData.experience.items.length).toBe(countBefore);
  });

  it("patches the RxResume template from merged cv data, preserving structure", () => {
    const jsonRaw = read(TEMPLATE_PATH);
    const cvData = loadCv();
    merge(cvData, parseResume(resumeRaw));

    const before = JSON.parse(jsonRaw);
    const patched = patchResumeJson(
      cvData,
      JSON.parse(jsonRaw),
    ) as typeof before;

    expect(Object.keys(patched)).toEqual(Object.keys(before));
    for (const key of Object.keys(before.sections)) {
      expect(patched.sections[key].items?.length).toBe(
        before.sections[key].items?.length,
      );
    }
    expect(patched.summary.content).toBe(`<p>${cvData.header.tagline}</p>`);
    expect(patched.sections.experience.items[0].position).toBe(
      "Senior Software Engineer",
    );
    expect(patched.sections.skills.items[0].keywords).toEqual([
      "TypeScript",
      "Python",
      "SQL",
    ]);
  });
});
