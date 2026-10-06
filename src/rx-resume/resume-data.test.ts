import { describe, it, expect } from "vitest";
import {
  renderSummaryHtml,
  toBasics,
  toCertificationItem,
  toCustomField,
  toEducationItem,
  toExperienceItem,
  toInterestItem,
  toLanguageItem,
  toProjectItem,
  toReferenceItem,
  toResumeData,
  toSkillItem,
} from "./resume-data.ts";
import type {
  ParsedContact,
  ParsedCertification,
  ParsedEduItem,
  ParsedJob,
  ParsedLanguage,
  ParsedProject,
  ParsedResume,
  ParsedSkillGroup,
} from "../sync-resume/parser.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const basics: ParsedContact = {
  name: "Jane Doe",
  headline: "Software Engineer",
  email: "jane.doe@example.com",
  phone: "+31 6 12345678",
  location: "City, Country",
  website: "example.com",
  profiles: [{ label: "GitHub", url: "https://github.com/jane-doe" }],
};

const job: ParsedJob = {
  company: "Acme Corp",
  location: "Amsterdam",
  role: "Senior Engineer",
  period: "01/2023 – Present",
  context: "Acme Corp builds widgets.",
  bullets: ["Built X", "Improved Y by 30%"],
  stack: "React, TypeScript",
  website: "https://acme.example/",
};

const skillGroup: ParsedSkillGroup = {
  heading: "Languages",
  items: ["TypeScript", "Python"],
};

const eduItem: ParsedEduItem = {
  school: "Example University",
  location: "Springfield",
  degree: "Master's degree, Engineering",
  period: "2018 – 2019",
  context: "Graduated with honours.",
  bullets: ["(link) Degree course", "Thesis: Foo Bar"],
};

const project: ParsedProject = {
  title: "Widget Dashboard",
  context: "Streams widget prices in real time.",
  stack: "Next.js, React",
  links: [],
};

const certification: ParsedCertification = {
  title: "Example Security Essentials",
  issuer: "Example Issuer",
  credentialIds: ["EX-0001", "EX-0002"],
};

const language: ParsedLanguage = {
  language: "English",
  fluency: "Full Professional Proficiency",
};

const parsed: ParsedResume = {
  contact: basics,
  summary: "Senior engineer shipping products.",
  jobs: [job],
  skillGroups: [skillGroup],
  eduItems: [eduItem],
  projects: [project],
  certifications: [certification],
  languages: [language],
  interests: ["Cycling"],
  references: ["References available upon request"],
};

// ─── renderSummaryHtml ────────────────────────────────────────────────────────

describe("renderSummaryHtml", () => {
  it("wraps a single paragraph in <p>", () => {
    expect(renderSummaryHtml("Senior engineer.")).toBe(
      "<p>Senior engineer.</p>",
    );
  });

  it("joins hard-wrapped lines of one paragraph with a space", () => {
    expect(renderSummaryHtml("Senior engineer\nshipping products.")).toBe(
      "<p>Senior engineer shipping products.</p>",
    );
  });

  it("renders each blank-line-separated paragraph as its own <p>", () => {
    expect(renderSummaryHtml("First.\n\nSecond.")).toBe(
      "<p>First.</p><p>Second.</p>",
    );
  });

  it("returns an empty string for an empty summary", () => {
    expect(renderSummaryHtml("")).toBe("");
  });
});

// ─── toBasics ─────────────────────────────────────────────────────────────────

describe("toBasics", () => {
  it("maps the personal details one to one", () => {
    expect(toBasics(basics)).toMatchObject({
      name: "Jane Doe",
      headline: "Software Engineer",
      email: "jane.doe@example.com",
      phone: "+31 6 12345678",
      location: "City, Country",
    });
  });

  it("maps the header links to custom fields, shown in the resume header", () => {
    const data = toBasics(basics);
    expect(data).not.toHaveProperty("profiles");
    expect(data.customFields).toEqual([toCustomField(basics.profiles[0])]);
  });

  it("adds a protocol to a bare website and keeps it as the label", () => {
    expect(toBasics(basics).website).toEqual({
      url: "https://example.com",
      label: "example.com",
    });
  });

  it("keeps a website that already has a protocol, without a label", () => {
    expect(
      toBasics({ ...basics, website: "http://example.com/me" }).website,
    ).toEqual({ url: "http://example.com/me", label: "" });
  });

  it("leaves the website empty when there is none", () => {
    expect(toBasics({ ...basics, website: "" }).website).toEqual({
      url: "",
      label: "",
    });
  });
});

// ─── toExperienceItem ─────────────────────────────────────────────────────────

describe("toExperienceItem", () => {
  it("maps company, role, location and period", () => {
    expect(toExperienceItem(job)).toMatchObject({
      company: "Acme Corp",
      position: "Senior Engineer",
      location: "Amsterdam",
      period: "01/2023 – Present",
    });
  });

  it("renders context, bullets and tech stack into the HTML description", () => {
    expect(toExperienceItem(job).description).toBe(
      "<p>Acme Corp builds widgets.</p>" +
        "<p>• Built X</p><p>• Improved Y by 30%</p>" +
        "<p><strong>Tech Stack:</strong> React, TypeScript</p>",
    );
  });

  it("maps the company URL to the website", () => {
    expect(toExperienceItem(job).website).toEqual({
      url: "https://acme.example/",
      label: "",
      inlineLink: false,
    });
  });

  it("omits the website key when the job has no URL", () => {
    expect(toExperienceItem({ ...job, website: "" })).not.toHaveProperty(
      "website",
    );
  });
});

// ─── toSkillItem ──────────────────────────────────────────────────────────────

describe("toSkillItem", () => {
  it("maps heading to name and items to keywords", () => {
    expect(toSkillItem(skillGroup)).toEqual({
      name: "Languages",
      keywords: ["TypeScript", "Python"],
    });
  });

  it("copies keywords instead of sharing the parsed array", () => {
    expect(toSkillItem(skillGroup).keywords).not.toBe(skillGroup.items);
  });
});

// ─── toEducationItem ──────────────────────────────────────────────────────────

describe("toEducationItem", () => {
  it("maps school, degree, location and period", () => {
    expect(toEducationItem(eduItem)).toMatchObject({
      school: "Example University",
      degree: "Master's degree, Engineering",
      location: "Springfield",
      period: "2018 – 2019",
    });
  });

  it("renders context and bullets into the HTML description", () => {
    expect(toEducationItem(eduItem).description).toBe(
      "<p>Graduated with honours.</p>" +
        "<p>• (link) Degree course</p><p>• Thesis: Foo Bar</p>",
    );
  });

  it("omits the context paragraph when the context is empty", () => {
    expect(toEducationItem({ ...eduItem, context: "" }).description).toBe(
      "<p>• (link) Degree course</p><p>• Thesis: Foo Bar</p>",
    );
  });
});

// ─── toProjectItem ────────────────────────────────────────────────────────────

describe("toProjectItem", () => {
  it("maps title to name and renders context and tech stack", () => {
    expect(toProjectItem(project)).toEqual({
      name: "Widget Dashboard",
      description:
        "<p>Streams widget prices in real time.</p>" +
        "<p><strong>Tech Stack:</strong> Next.js, React</p>",
    });
  });

  it("maps the first link to the website, with its label", () => {
    const item = toProjectItem({
      ...project,
      links: [{ label: "GitHub", url: "https://github.com/jane-doe/widgets" }],
    });
    expect(item.website).toEqual({
      url: "https://github.com/jane-doe/widgets",
      label: "GitHub",
      inlineLink: false,
    });
    expect(item.description).toBe(toProjectItem(project).description);
  });

  it("appends further links to the end of the description", () => {
    const item = toProjectItem({
      ...project,
      links: [
        { label: "GitHub", url: "https://github.com/jane-doe/widgets" },
        { label: "Demo", url: "https://widgets.example/" },
        { label: "Docs", url: "https://docs.example/" },
      ],
    });
    expect(item.description).toBe(
      toProjectItem(project).description +
        '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://widgets.example/">Demo</a>' +
        ' | <a target="_blank" rel="noopener noreferrer nofollow" href="https://docs.example/">Docs</a></p>',
    );
  });
});

// ─── toCustomField ────────────────────────────────────────────────────────────

describe("toCustomField", () => {
  it("maps the label to the text and the URL to the link", () => {
    expect(
      toCustomField({ label: "GitHub", url: "https://github.com/jane-doe" }),
    ).toEqual({
      icon: "github-logo",
      text: "GitHub",
      link: "https://github.com/jane-doe",
    });
  });

  it("matches the network icon regardless of case", () => {
    expect(
      toCustomField({ label: "linkedin", url: "https://linkedin.com/in/jane" })
        .icon,
    ).toBe("linkedin-logo");
  });

  it("falls back to a link icon for an unknown network", () => {
    expect(
      toCustomField({ label: "Blog", url: "https://blog.example" }).icon,
    ).toBe("link");
  });
});

// ─── toResumeData ─────────────────────────────────────────────────────────────

describe("toResumeData", () => {
  it("nests every parsed section under the API's data paths", () => {
    expect(toResumeData(parsed)).toEqual({
      basics: toBasics(basics),
      summary: { content: "<p>Senior engineer shipping products.</p>" },
      sections: {
        experience: { items: [toExperienceItem(job)] },
        skills: { items: [toSkillItem(skillGroup)] },
        education: { items: [toEducationItem(eduItem)] },
        projects: { items: [toProjectItem(project)] },
        certifications: { items: [toCertificationItem(certification)] },
        languages: { items: [toLanguageItem(language)] },
        interests: { items: [toInterestItem("Cycling")] },
        references: {
          items: [toReferenceItem("References available upon request")],
        },
      },
    });
  });

  it("returns empty item lists when the resume has no sections", () => {
    const data = toResumeData({
      ...parsed,
      contact: { ...basics, profiles: [] },
      jobs: [],
      skillGroups: [],
      eduItems: [],
      projects: [],
      certifications: [],
      languages: [],
      interests: [],
      references: [],
    });
    expect(
      Object.values(data.sections).every(
        (section) => section.items.length === 0,
      ),
    ).toBe(true);
  });
});
