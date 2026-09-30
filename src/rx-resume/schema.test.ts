import { describe, it, expect } from "vitest";
import {
  CreateResumeBodySchema,
  ExperienceItemSchema,
  ResumeDataSchema,
  ResumeSchema,
  SkillsSectionSchema,
  UpdateResumeBodySchema,
} from "./schema.ts";
import {
  SkillKeywordLayout,
  type ExperienceItem,
  type Resume,
  type ResumeData,
  type Section,
} from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function section<TItem>(title: string, items: TItem[] = []): Section<TItem> {
  return {
    title,
    icon: "",
    columns: 1,
    hidden: false,
    keepTogether: false,
    startOnNewPage: false,
    items,
  };
}

const experienceItem: ExperienceItem = {
  id: "experience-1",
  hidden: false,
  company: "Acme Corp",
  position: "Engineer",
  location: "Amsterdam",
  period: "01/2023 – Present",
  website: { url: "", label: "", inlineLink: false },
  description: "<p>Builds widgets.</p>",
  roles: [],
};

const data: ResumeData = {
  basics: {
    name: "Jane Doe",
    headline: "Software Engineer",
    email: "jane.doe@example.com",
    phone: "",
    location: "City, Country",
    website: { url: "https://example.com", label: "" },
    customFields: [],
  },
  summary: {
    title: "Summary",
    icon: "",
    columns: 1,
    hidden: false,
    keepTogether: false,
    startOnNewPage: false,
    content: "<p>Senior engineer.</p>",
  },
  sections: {
    experience: section("Experience", [experienceItem]),
    skills: section("Skills"),
    education: section("Education"),
    projects: section("Projects"),
    certifications: section("Certifications"),
    languages: section("Languages"),
    interests: section("Interests"),
    references: section("References"),
    // Not fed by Resume.md; carried through untyped.
    awards: section("Awards"),
  },
  metadata: {
    layout: {
      sidebarWidth: 35,
      pages: [{ fullWidth: true, main: ["summary"], sidebar: [] }],
    },
    template: "scizor",
  },
  picture: { hidden: true, url: "" },
};

const resume: Resume = {
  id: "resume-1",
  name: "Jane Doe",
  slug: "jane-doe",
  tags: [],
  isPublic: false,
  showDownloadButtons: true,
  isLocked: false,
  hasPassword: false,
  updatedAt: "2026-09-29T00:00:00.000Z",
  data,
};

// ─── ResumeDataSchema ─────────────────────────────────────────────────────────

describe("ResumeDataSchema", () => {
  it("accepts full resume data", () => {
    expect(ResumeDataSchema.safeParse(data).success).toBe(true);
  });

  it("keeps untyped blocks, sections and metadata settings", () => {
    const parsed = ResumeDataSchema.parse(data);
    expect(parsed.picture).toEqual(data.picture);
    expect(parsed.sections.awards).toEqual(data.sections.awards);
    expect(parsed.metadata.template).toBe("scizor");
  });

  it("rejects data without a section Resume.md feeds", () => {
    const { experience: _experience, ...sections } = data.sections;
    const result = ResumeDataSchema.safeParse({ ...data, sections });
    expect(result.success).toBe(false);
  });
});

// ─── Item and section schemas ─────────────────────────────────────────────────

describe("ExperienceItemSchema", () => {
  it("accepts a complete item", () => {
    expect(ExperienceItemSchema.parse(experienceItem)).toEqual(experienceItem);
  });

  it("rejects an item without an id", () => {
    const { id: _id, ...withoutId } = experienceItem;
    expect(ExperienceItemSchema.safeParse(withoutId).success).toBe(false);
  });
});

describe("SkillsSectionSchema", () => {
  it("accepts a known keyword layout", () => {
    const skills = {
      ...section("Skills"),
      keywordLayout: SkillKeywordLayout.Inline,
    };
    expect(SkillsSectionSchema.safeParse(skills).success).toBe(true);
  });

  it("rejects an unknown keyword layout", () => {
    const skills = { ...section("Skills"), keywordLayout: "grid" };
    expect(SkillsSectionSchema.safeParse(skills).success).toBe(false);
  });
});

// ─── Requests and responses ───────────────────────────────────────────────────

describe("CreateResumeBodySchema", () => {
  it("accepts a body without withSampleData", () => {
    const body = { name: "Jane", slug: "jane", tags: ["cv"] };
    expect(CreateResumeBodySchema.parse(body)).toEqual(body);
  });

  it("rejects a body without a slug", () => {
    const body = { name: "Jane", tags: [] };
    expect(CreateResumeBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("UpdateResumeBodySchema", () => {
  it("accepts an empty body, since every field is optional", () => {
    expect(UpdateResumeBodySchema.safeParse({}).success).toBe(true);
  });

  it("rejects incomplete data", () => {
    const body = { data: { basics: data.basics } };
    expect(UpdateResumeBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("ResumeSchema", () => {
  it("accepts a resume response", () => {
    expect(ResumeSchema.safeParse(resume).success).toBe(true);
  });

  it("rejects a response without data", () => {
    const { data: _data, ...withoutData } = resume;
    expect(ResumeSchema.safeParse(withoutData).success).toBe(false);
  });
});
