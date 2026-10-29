import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseResume } from "../sync-resume/parser.ts";
import { toResumeData } from "./resume-data.ts";
import {
  applyResumeData,
  toApiCertificationItem,
  toApiCustomField,
  toApiEducationItem,
  toApiExperienceItem,
  toApiInterestItem,
  toApiLanguageItem,
  toApiProjectItem,
  toApiReferenceItem,
  toApiSkillItem,
} from "./apply-data.ts";
import type {
  EducationItem,
  ParsedResumeData,
  ResumeData,
  Section,
} from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_WEBSITE = { url: "", label: "", inlineLink: false };

function makeSection<TItem>(title: string, items: TItem[]): Section<TItem> {
  return {
    title,
    icon: "",
    columns: 1,
    hidden: false,
    showHeading: true,
    keepTogether: false,
    startOnNewPage: false,
    items,
  };
}

/** A freshly created resume, as returned by GET /resumes/{id}. */
function makeResumeData(): ResumeData {
  return {
    picture: { hidden: true },
    basics: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: { url: "", label: "" },
      customFields: [{ id: "cf-1", icon: "star", text: "Custom", link: "" }],
    },
    summary: {
      title: "Summary",
      icon: "",
      columns: 1,
      hidden: false,
      keepTogether: false,
      startOnNewPage: false,
      content: "",
    },
    sections: {
      experience: makeSection("Experience", []),
      skills: { ...makeSection("Skills", []), keywordLayout: "inline" },
      education: makeSection("Education", []),
      projects: makeSection("Projects", []),
      certifications: makeSection("Certifications", []),
      languages: makeSection("Languages", []),
      interests: makeSection("Interests", []),
      references: makeSection("References", []),
      awards: makeSection("Awards", []),
    },
    metadata: {
      template: "onyx",
      layout: {
        sidebarWidth: 35,
        pages: [
          {
            fullWidth: false,
            main: ["summary", "experience", "education"],
            sidebar: ["skills", "interests"],
          },
        ],
      },
    },
  };
}

const parsed: ParsedResumeData = {
  basics: {
    name: "Jane Doe",
    headline: "Software Engineer",
    email: "jane.doe@example.com",
    phone: "+31 6 12345678",
    location: "City, Country",
    website: { url: "https://example.com", label: "example.com" },
    customFields: [
      {
        icon: "github-logo",
        text: "GitHub",
        link: "https://github.com/jane-doe",
      },
    ],
  },
  summary: { content: "<p>Senior engineer.</p>" },
  sections: {
    experience: {
      items: [
        {
          company: "Acme Corp",
          position: "Senior Engineer",
          location: "Amsterdam",
          period: "01/2023 – Present",
          description: "<p>• Built X</p>",
        },
      ],
    },
    skills: { items: [{ name: "Languages", keywords: ["TypeScript"] }] },
    education: {
      items: [
        {
          school: "Example University",
          degree: "Master's degree",
          area: "Engineering",
          grade: "9.0 / 10",
          location: "Springfield",
          period: "2018 – 2019",
          description: "<p>• Thesis</p>",
        },
      ],
    },
    projects: {
      items: [{ name: "Widget Dashboard", description: "<p>Streams.</p>" }],
    },
    certifications: {
      items: [
        {
          title: "Example Security Essentials",
          issuer: "Example Issuer",
          description: "<p>Credential ID: EX-0001</p>",
        },
      ],
    },
    languages: { items: [{ language: "English", fluency: "Native" }] },
    interests: { items: [{ name: "Cycling" }] },
    references: { items: [{ name: "References available upon request" }] },
  },
};

/** Returns ids "id-1", "id-2", … in call order. */
function sequentialIds(): () => string {
  let count = 0;
  return () => `id-${++count}`;
}

// ─── Item completion ──────────────────────────────────────────────────────────

describe("toApiExperienceItem", () => {
  const item = parsed.sections.experience.items[0];

  it("fills every required API field around the parsed keys", () => {
    expect(toApiExperienceItem(item, "id-1")).toEqual({
      id: "id-1",
      hidden: false,
      company: "Acme Corp",
      position: "Senior Engineer",
      location: "Amsterdam",
      period: "01/2023 – Present",
      website: EMPTY_WEBSITE,
      description: "<p>• Built X</p>",
      roles: [],
    });
  });

  it("keeps a parsed website", () => {
    const website = {
      url: "https://acme.example/",
      label: "",
      inlineLink: false,
    };
    expect(toApiExperienceItem({ ...item, website }, "id-1").website).toEqual(
      website,
    );
  });
});

describe("toApiSkillItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(toApiSkillItem(parsed.sections.skills.items[0], "id-1")).toEqual({
      id: "id-1",
      hidden: false,
      icon: "",
      iconColor: "",
      name: "Languages",
      proficiency: "",
      level: 0,
      keywords: ["TypeScript"],
    });
  });
});

describe("toApiEducationItem", () => {
  const item = parsed.sections.education.items[0];

  it("fills every required API field around the parsed keys", () => {
    expect(toApiEducationItem(item, "id-1")).toEqual({
      id: "id-1",
      hidden: false,
      school: "Example University",
      degree: "Master's degree",
      area: "Engineering",
      grade: "9.0 / 10",
      location: "Springfield",
      period: "2018 – 2019",
      website: EMPTY_WEBSITE,
      description: "<p>• Thesis</p>",
    });
  });

  it("gives each item its own website object", () => {
    expect(toApiEducationItem(item, "a").website).not.toBe(
      toApiEducationItem(item, "b").website,
    );
  });
});

describe("toApiProjectItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(toApiProjectItem(parsed.sections.projects.items[0], "id-1")).toEqual(
      {
        id: "id-1",
        hidden: false,
        name: "Widget Dashboard",
        period: "",
        website: EMPTY_WEBSITE,
        description: "<p>Streams.</p>",
      },
    );
  });
});

describe("toApiProjectItem website", () => {
  it("keeps a parsed website", () => {
    const website = {
      url: "https://github.com/jane-doe/widgets",
      label: "GitHub",
      inlineLink: false,
    };
    expect(
      toApiProjectItem(
        { ...parsed.sections.projects.items[0], website },
        "id-1",
      ).website,
    ).toEqual(website);
  });
});

describe("toApiCustomField", () => {
  it("adds the id to the parsed field", () => {
    expect(toApiCustomField(parsed.basics.customFields[0], "id-1")).toEqual({
      id: "id-1",
      icon: "github-logo",
      text: "GitHub",
      link: "https://github.com/jane-doe",
    });
  });
});

describe("toApiCertificationItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(
      toApiCertificationItem(parsed.sections.certifications.items[0], "id-1"),
    ).toEqual({
      id: "id-1",
      hidden: false,
      title: "Example Security Essentials",
      issuer: "Example Issuer",
      date: "",
      website: EMPTY_WEBSITE,
      description: "<p>Credential ID: EX-0001</p>",
    });
  });
});

describe("toApiLanguageItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(
      toApiLanguageItem(parsed.sections.languages.items[0], "id-1"),
    ).toEqual({
      id: "id-1",
      hidden: false,
      language: "English",
      fluency: "Native",
      level: 0,
    });
  });
});

describe("toApiInterestItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(
      toApiInterestItem(parsed.sections.interests.items[0], "id-1"),
    ).toEqual({
      id: "id-1",
      hidden: false,
      icon: "",
      iconColor: "",
      name: "Cycling",
      keywords: [],
    });
  });
});

describe("toApiReferenceItem", () => {
  it("fills every required API field around the parsed keys", () => {
    expect(
      toApiReferenceItem(parsed.sections.references.items[0], "id-1"),
    ).toEqual({
      id: "id-1",
      hidden: false,
      name: "References available upon request",
      position: "",
      website: EMPTY_WEBSITE,
      phone: "",
      description: "",
    });
  });
});

// ─── applyResumeData ──────────────────────────────────────────────────────────

describe("applyResumeData", () => {
  it("sets the parsed basics", () => {
    const { basics } = applyResumeData(
      makeResumeData(),
      parsed,
      sequentialIds(),
    );
    expect(basics).toMatchObject({
      name: "Jane Doe",
      email: "jane.doe@example.com",
      website: { url: "https://example.com", label: "example.com" },
    });
  });

  it("replaces the custom fields with the parsed ones, each with an id", () => {
    const { basics } = applyResumeData(
      makeResumeData(),
      parsed,
      sequentialIds(),
    );
    expect(basics.customFields).toEqual([
      {
        id: expect.stringMatching(/^id-\d+$/),
        icon: "github-logo",
        text: "GitHub",
        link: "https://github.com/jane-doe",
      },
    ]);
  });

  it("sets the summary content and keeps the summary layout", () => {
    const data = applyResumeData(makeResumeData(), parsed, sequentialIds());
    expect(data.summary).toEqual({
      ...makeResumeData().summary,
      content: "<p>Senior engineer.</p>",
    });
  });

  it("replaces the items of each parsed section", () => {
    const { sections } = applyResumeData(
      makeResumeData(),
      parsed,
      sequentialIds(),
    );
    expect(sections.experience.items.map((i) => i.company)).toEqual([
      "Acme Corp",
    ]);
    expect(sections.skills.items.map((i) => i.name)).toEqual(["Languages"]);
    expect(sections.education.items.map((i) => i.school)).toEqual([
      "Example University",
    ]);
    expect(sections.projects.items.map((i) => i.name)).toEqual([
      "Widget Dashboard",
    ]);
    expect(sections.certifications.items.map((i) => i.title)).toEqual([
      "Example Security Essentials",
    ]);
    expect(sections.languages.items.map((i) => i.language)).toEqual([
      "English",
    ]);
    expect(sections.interests.items.map((i) => i.name)).toEqual(["Cycling"]);
    expect(sections.references.items.map((i) => i.name)).toEqual([
      "References available upon request",
    ]);
  });

  it("assigns a fresh id to every item", () => {
    const { sections } = applyResumeData(
      makeResumeData(),
      parsed,
      sequentialIds(),
    );
    const ids = [
      ...sections.experience.items,
      ...sections.skills.items,
      ...sections.education.items,
      ...sections.projects.items,
      ...sections.certifications.items,
      ...sections.languages.items,
      ...sections.interests.items,
      ...sections.references.items,
    ].map((item) => item.id);

    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });

  it("keeps section layout and section-specific fields", () => {
    const data = applyResumeData(makeResumeData(), parsed, sequentialIds());
    const { items: _items, ...skillsLayout } = data.sections.skills;
    const { items: _base, ...expected } = makeResumeData().sections.skills;
    expect(skillsLayout).toEqual(expected);
  });

  it("leaves unparsed sections and top-level blocks untouched", () => {
    const base = makeResumeData();
    const data = applyResumeData(base, parsed, sequentialIds());
    expect(data.sections.awards).toEqual(base.sections.awards);
    expect(data.picture).toEqual(base.picture);
    expect(data.metadata).toEqual(base.metadata);
  });

  it("does not mutate the given data", () => {
    const base = makeResumeData();
    applyResumeData(base, parsed, sequentialIds());
    expect(base).toEqual(makeResumeData());
  });
});

// ─── applyResumeData from Resume.md ───────────────────────────────────────────

describe("applyResumeData education from Resume.md", () => {
  const RESUME_FIXTURE = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../sync-resume/fixtures/Resume.md",
    ),
    "utf-8",
  );
  const EDUCATION_TITLE_LINE =
    "**Bachelor's degree, Computer Science** | 2012 – 2016";

  /** Updates a fresh resume from the fixture with its title line replaced. */
  function updatedEducation(titleLines: string): EducationItem {
    const markdown = RESUME_FIXTURE.replace(EDUCATION_TITLE_LINE, titleLines);
    const data = toResumeData(parseResume(markdown));
    const { sections } = applyResumeData(
      makeResumeData(),
      data,
      sequentialIds(),
    );
    return sections.education.items[0];
  }

  it("splits the title on its first comma into degree and area", () => {
    expect(updatedEducation(EDUCATION_TITLE_LINE)).toMatchObject({
      degree: "Bachelor's degree",
      area: "Computer Science",
    });
  });

  it("reads the grade from a **Grade:** line", () => {
    const titleLines = `${EDUCATION_TITLE_LINE}\n\n**Grade:** 9.0 / 10`;
    expect(updatedEducation(titleLines).grade).toBe("9.0 / 10");
  });

  it("reads grade and location from adjacent lines, the location over the heading's", () => {
    const titleLines = [
      EDUCATION_TITLE_LINE,
      "",
      "**Grade:** 9.0 / 10",
      "**Location:** Amsterdam",
    ].join("\n");
    expect(updatedEducation(titleLines)).toMatchObject({
      grade: "9.0 / 10",
      location: "Amsterdam",
    });
  });

  it("reads the area from an **Area:** line and keeps the whole title as the degree", () => {
    const titleLines = [
      "**Master of Science, Honours** | 2016 – 2018",
      "",
      "**Area:** Computer Science",
    ].join("\n");
    expect(updatedEducation(titleLines)).toMatchObject({
      degree: "Master of Science, Honours",
      area: "Computer Science",
    });
  });
});
