import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import {
  CvDataSchema,
  ParsedEduItemSchema,
  ParsedJobSchema,
  ParsedResumeSchema,
  ParsedSkillGroupSchema,
  ResumeJsonSchema,
  ValidationMessage,
  formatIssuePath,
  validateParsedResume,
} from "./schema.ts";
import type {
  ParsedEduItem,
  ParsedJob,
  ParsedResume,
  ParsedSkillGroup,
} from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const job: ParsedJob = {
  company: "Acme Corp",
  location: "Amsterdam",
  role: "Senior Engineer",
  period: "01/2023 – Present",
  context: "Acme Corp builds widgets.",
  bullets: ["Led the widget platform."],
  stack: "React, TypeScript",
  website: "https://acme.example/",
};

const skillGroup: ParsedSkillGroup = {
  heading: "Languages",
  items: ["TypeScript", "Python"],
};

const eduItem: ParsedEduItem = {
  school: "University A",
  location: "Springfield",
  degree: "Master's degree, Engineering",
  period: "2018 – 2019",
  context: "Coursework completed.",
  bullets: ["Thesis"],
};

const resume: ParsedResume = {
  basics: {
    name: "Jane Doe",
    headline: "Software Engineer",
    email: "jane.doe@example.com",
    phone: "",
    location: "City, Country",
    website: "example.com",
    profiles: [{ label: "GitHub", url: "https://github.com/jane-doe" }],
  },
  summary: "Senior engineer.",
  jobs: [job, { ...job, company: "Beta Inc" }],
  skillGroups: [skillGroup],
  eduItems: [eduItem],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
  references: [],
};

// ─── formatIssuePath ──────────────────────────────────────────────────────────

describe("formatIssuePath", () => {
  it("joins keys with dots and wraps indices in brackets", () => {
    expect(formatIssuePath(["jobs", 2, "role"])).toBe("jobs[2].role");
  });

  it("formats a top-level key as-is", () => {
    expect(formatIssuePath(["summary"])).toBe("summary");
  });

  it("formats an empty path as an empty string", () => {
    expect(formatIssuePath([])).toBe("");
  });
});

// ─── Item schemas ─────────────────────────────────────────────────────────────

describe("ParsedJobSchema", () => {
  it("accepts a complete job", () => {
    expect(ParsedJobSchema.parse(job)).toEqual(job);
  });

  it("accepts a job with no location, context, bullets or website", () => {
    const bare = {
      ...job,
      location: "",
      context: "",
      bullets: [],
      website: "",
    };
    expect(ParsedJobSchema.safeParse(bare).success).toBe(true);
  });

  it.each(["company", "role", "period", "stack"] as const)(
    "rejects an empty %s",
    (field) => {
      expect(ParsedJobSchema.safeParse({ ...job, [field]: "" }).success).toBe(
        false,
      );
    },
  );
});

describe("ParsedSkillGroupSchema", () => {
  it("accepts a group with items", () => {
    expect(ParsedSkillGroupSchema.parse(skillGroup)).toEqual(skillGroup);
  });

  it("rejects an empty heading", () => {
    const result = ParsedSkillGroupSchema.safeParse({
      ...skillGroup,
      heading: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a group without items", () => {
    const result = ParsedSkillGroupSchema.safeParse({
      ...skillGroup,
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("ParsedEduItemSchema", () => {
  it("accepts a complete education item", () => {
    expect(ParsedEduItemSchema.parse(eduItem)).toEqual(eduItem);
  });

  it("accepts an item with no location, context or bullets", () => {
    const bare = { ...eduItem, location: "", context: "", bullets: [] };
    expect(ParsedEduItemSchema.safeParse(bare).success).toBe(true);
  });

  it.each(["school", "degree", "period"] as const)(
    "rejects an empty %s",
    (field) => {
      expect(
        ParsedEduItemSchema.safeParse({ ...eduItem, [field]: "" }).success,
      ).toBe(false);
    },
  );
});

// ─── ParsedResumeSchema ───────────────────────────────────────────────────────

describe("ParsedResumeSchema", () => {
  it("accepts a resume with only the required sections filled", () => {
    expect(ParsedResumeSchema.parse(resume)).toEqual(resume);
  });
});

// ─── validateParsedResume ─────────────────────────────────────────────────────

describe("validateParsedResume", () => {
  const { Required, Empty } = ValidationMessage;

  it("returns a valid resume unchanged", () => {
    expect(validateParsedResume(resume)).toEqual(resume);
  });

  it.each<[string, ParsedResume, string]>([
    ["summary", { ...resume, summary: "" }, `summary: ${Required}`],
    ["jobs", { ...resume, jobs: [] }, `jobs: ${Empty}`],
    ["skill groups", { ...resume, skillGroups: [] }, `skillGroups: ${Empty}`],
    ["education items", { ...resume, eduItems: [] }, `eduItems: ${Empty}`],
    [
      "job company",
      { ...resume, jobs: [{ ...job, company: "" }] },
      `jobs[0].company: ${Required}`,
    ],
    [
      "job role",
      { ...resume, jobs: [job, job, { ...job, role: "" }] },
      `jobs[2].role: ${Required}`,
    ],
    [
      "job period",
      { ...resume, jobs: [{ ...job, period: "" }] },
      `jobs[0].period: ${Required}`,
    ],
    [
      "job stack",
      { ...resume, jobs: [job, { ...job, stack: "" }] },
      `jobs[1].stack: ${Required}`,
    ],
    [
      "skill group heading",
      { ...resume, skillGroups: [{ ...skillGroup, heading: "" }] },
      `skillGroups[0].heading: ${Required}`,
    ],
    [
      "skill group items",
      { ...resume, skillGroups: [{ ...skillGroup, items: [] }] },
      `skillGroups[0].items: ${Empty}`,
    ],
    [
      "education school",
      { ...resume, eduItems: [{ ...eduItem, school: "" }] },
      `eduItems[0].school: ${Required}`,
    ],
    [
      "education degree",
      { ...resume, eduItems: [{ ...eduItem, degree: "" }] },
      `eduItems[0].degree: ${Required}`,
    ],
    [
      "education period",
      { ...resume, eduItems: [{ ...eduItem, period: "" }] },
      `eduItems[0].period: ${Required}`,
    ],
  ])("names the path of a missing %s", (_label, invalid, message) => {
    expect(() => validateParsedResume(invalid)).toThrow(message);
  });

  it("reports a field that is absent altogether as required", () => {
    const { summary: _summary, ...withoutSummary } = resume;
    expect(() => validateParsedResume(withoutSummary)).toThrow(
      `summary: ${Required}`,
    );
  });

  it("lists every failure in one error", () => {
    const invalid = {
      ...resume,
      summary: "",
      jobs: [{ ...job, role: "", stack: "" }],
    };
    expect(() => validateParsedResume(invalid)).toThrow(
      [
        "Invalid Resume.md:",
        `  summary: ${Required}`,
        `  jobs[0].role: ${Required}`,
        `  jobs[0].stack: ${Required}`,
      ].join("\n"),
    );
  });
});

// ─── CvDataSchema ─────────────────────────────────────────────────────────────

describe("CvDataSchema", () => {
  const cvRaw = readFileSync(resolve(__dirname, "fixtures/cv.md"), "utf-8");
  const frontmatter: unknown = yaml.load(cvRaw.split("---\n")[1]);

  it("accepts the fixture CV frontmatter", () => {
    expect(CvDataSchema.safeParse(frontmatter).success).toBe(true);
  });

  it("rejects a CV without a header", () => {
    expect(CvDataSchema.safeParse({ contact: { items: [] } }).success).toBe(
      false,
    );
  });
});

// ─── ResumeJsonSchema ─────────────────────────────────────────────────────────

describe("ResumeJsonSchema", () => {
  const template: unknown = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../resume/RxResume/Resume.template.json"),
      "utf-8",
    ),
  );

  it("accepts the RxResume template and keeps its untyped fields", () => {
    expect(ResumeJsonSchema.parse(template)).toEqual(template);
  });

  it("rejects a resume without a summary", () => {
    expect(ResumeJsonSchema.safeParse({ sections: {} }).success).toBe(false);
  });
});
