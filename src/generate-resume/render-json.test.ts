import { describe, it, expect } from "vitest";
import {
  renderExperienceDescriptionHtml,
  renderEducationDescriptionHtml,
  renderProjectDescriptionHtml,
  renderCertDescriptionHtml,
  patchResumeJson,
} from "./render-json.ts";
import type {
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  CvData,
} from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const job: ExperienceItem = {
  company: "Acme Corp",
  location: "Amsterdam",
  role: "Senior Engineer",
  dates: "01/2023 – Present",
  datetime: "2023-01",
  context: "A fintech scale-up.",
  bullets: ["Built X", "Improved Y by 30%"],
  stack: "React, TypeScript, Node.js",
};

const jobNoContext: ExperienceItem = { ...job, context: null };

const education: EducationItem = {
  school: "MIT",
  location: "Cambridge",
  degree: "BSc Computer Science",
  dates: "2010 – 2014",
  datetime: "2010/2014",
  context: "Graduated with honours.",
  bullets: [
    { text: "Distributed Systems", linkText: "CS6.824", href: "https://example.com/cs6824" },
    { text: "Thesis: Foo Bar", linkText: null, href: null },
  ],
};

const project: ProjectItem = {
  title: "My Side Project",
  context: "A small tool for developers.",
  links: [{ label: "GitHub", href: "https://github.com/example" }],
  stack: "TypeScript, Vite",
};

const cert: CertificationItem = {
  title: "AWS Solutions Architect",
  issuer: "Amazon",
  credentials: [{ id: "AWS-12345", href: "/certs/aws.pdf" }],
};

const certMultipleCredentials: CertificationItem = {
  ...cert,
  credentials: [
    { id: "ID-1", href: "/1.pdf" },
    { id: "ID-2", href: "/2.pdf" },
    { id: "ID-3", href: "/3.pdf" },
  ],
};

// Minimal JSON that mirrors the shape of Resume.json
const minimalJson = {
  basics: { name: "Old Name" },
  sections: {
    experience: {
      items: [
        {
          id: "exp-1",
          hidden: false,
          company: "Acme Corp",
          position: "Old Role",
          location: "Old Location",
          period: "Old Period",
          description: "<p>old</p>",
          roles: [],
          website: { url: "https://example.com", label: "", inlineLink: false },
        },
      ],
    },
    skills: {
      items: [
        { id: "skill-1", hidden: false, name: "Frontend", keywords: ["OldSkill"], level: 0 },
      ],
    },
    education: {
      items: [
        {
          id: "edu-1",
          hidden: false,
          school: "MIT",
          degree: "BSc",
          area: "CS",
          period: "2010-2014",
          description: "<p>old edu</p>",
        },
      ],
    },
    projects: {
      items: [
        {
          id: "proj-1",
          hidden: false,
          name: "My Side Project",
          description: "<p>old project</p>",
          period: "",
        },
      ],
    },
    certifications: {
      items: [
        {
          id: "cert-1",
          hidden: false,
          title: "AWS Solutions Architect",
          issuer: "Old Issuer",
          description: "<p>old cert</p>",
        },
      ],
    },
    languages: {
      items: [
        { id: "lang-1", hidden: false, language: "English", fluency: "Old Fluency", level: 5 },
        { id: "lang-2", hidden: false, language: "Dutch", fluency: "Old Fluency", level: 3 },
      ],
    },
    interests: {
      items: [
        { id: "int-1", hidden: false, name: "OldInterest1", keywords: [] },
        { id: "int-2", hidden: false, name: "OldInterest2", keywords: [] },
      ],
    },
  },
  metadata: { template: "lapras", colors: { primary: "red" } },
};

const minimalCv: CvData = {
  header: { name: "New Name", title: "New Title" },
  contact: { items: [] },
  skillGroups: [{ id: "frontend", heading: "Frontend", items: ["React", "TypeScript"] }],
  summary: { heading: "Summary" },
  experience: { items: [job] },
  education: { items: [education] },
  projects: { items: [project] },
  certifications: { items: [cert] },
  footer: {
    languages: {
      items: ["English — Full Professional Proficiency", "Dutch — Conversational"],
    },
    interests: { text: "Cycling · Travel" },
    references: "Available upon request",
  },
};

// ─── renderExperienceDescriptionHtml ─────────────────────────────────────────

describe("renderExperienceDescriptionHtml", () => {
  it("wraps context in an opening <p> tag", () => {
    const output = renderExperienceDescriptionHtml(job);
    expect(output).toContain("<p>A fintech scale-up.</p>");
  });

  it("omits the context paragraph when context is null", () => {
    const output = renderExperienceDescriptionHtml(jobNoContext);
    expect(output).not.toContain("A fintech scale-up.");
  });

  it("wraps each bullet in <li><p>...</p></li> inside a <ul>", () => {
    const output = renderExperienceDescriptionHtml(job);
    expect(output).toContain("<ul>");
    expect(output).toContain("<li><p>Built X</p></li>");
    expect(output).toContain("<li><p>Improved Y by 30%</p></li>");
  });

  it("renders the tech stack in a closing <p> with a <strong> label", () => {
    const output = renderExperienceDescriptionHtml(job);
    expect(output).toContain(
      "<p><strong>Tech Stack:</strong> React, TypeScript, Node.js</p>",
    );
  });

  it("produces a single string with no newlines", () => {
    const output = renderExperienceDescriptionHtml(job);
    expect(output).not.toContain("\n");
  });
});

// ─── renderEducationDescriptionHtml ──────────────────────────────────────────

describe("renderEducationDescriptionHtml", () => {
  it("wraps context in an opening <p> tag when present", () => {
    const output = renderEducationDescriptionHtml(education);
    expect(output).toContain("<p>Graduated with honours.</p>");
  });

  it("renders a linked bullet as an <a> tag followed by the text", () => {
    const output = renderEducationDescriptionHtml(education);
    expect(output).toContain(
      '<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/cs6824">CS6.824</a>',
    );
    expect(output).toContain("Distributed Systems");
  });

  it("renders a plain bullet as text with no anchor tag", () => {
    const output = renderEducationDescriptionHtml(education);
    expect(output).toContain("Thesis: Foo Bar");
    // The plain bullet should not be wrapped in an <a>
    const plainBulletIndex = output.indexOf("Thesis: Foo Bar");
    const precedingChars = output.slice(Math.max(0, plainBulletIndex - 10), plainBulletIndex);
    expect(precedingChars).not.toContain("<a");
  });

  it("produces a single string with no newlines", () => {
    const output = renderEducationDescriptionHtml(education);
    expect(output).not.toContain("\n");
  });
});

// ─── renderProjectDescriptionHtml ────────────────────────────────────────────

describe("renderProjectDescriptionHtml", () => {
  it("wraps context in a <p> tag", () => {
    const output = renderProjectDescriptionHtml(project);
    expect(output).toContain("<p>A small tool for developers.</p>");
  });

  it("renders the tech stack in a <p> with a <strong> label", () => {
    const output = renderProjectDescriptionHtml(project);
    expect(output).toContain("<p><strong>Tech Stack:</strong> TypeScript, Vite</p>");
  });

  it("produces a single string with no newlines", () => {
    const output = renderProjectDescriptionHtml(project);
    expect(output).not.toContain("\n");
  });
});

// ─── renderCertDescriptionHtml ────────────────────────────────────────────────

describe("renderCertDescriptionHtml", () => {
  it("renders a single credential ID wrapped in a <p>", () => {
    const output = renderCertDescriptionHtml(cert);
    expect(output).toBe("<p>Credential ID: AWS-12345</p>");
  });

  it("joins multiple credential IDs with a comma and space", () => {
    const output = renderCertDescriptionHtml(certMultipleCredentials);
    expect(output).toBe("<p>Credential ID: ID-1, ID-2, ID-3</p>");
  });

  it("returns empty string when there are no credentials", () => {
    const noCreds: CertificationItem = { ...cert, credentials: [] };
    expect(renderCertDescriptionHtml(noCreds)).toBe("");
  });
});

// ─── patchResumeJson ─────────────────────────────────────────────────────────

describe("patchResumeJson", () => {
  it("updates experience position, location, period and description when company matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const exp = result.sections.experience.items[0];
    expect(exp.position).toBe("Senior Engineer");
    expect(exp.location).toBe("Amsterdam");
    expect(exp.period).toBe("01/2023 – Present");
    expect(exp.description).toContain("A fintech scale-up.");
    expect(exp.description).toContain("<li><p>Built X</p></li>");
  });

  it("preserves experience id, hidden flag and website url", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const exp = result.sections.experience.items[0];
    expect(exp.id).toBe("exp-1");
    expect(exp.hidden).toBe(false);
    expect(exp.website.url).toBe("https://example.com");
  });

  it("updates skill name and keywords when heading matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const skill = result.sections.skills.items[0];
    expect(skill.name).toBe("Frontend");
    expect(skill.keywords).toEqual(["React", "TypeScript"]);
  });

  it("preserves skill id, hidden flag and level", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const skill = result.sections.skills.items[0];
    expect(skill.id).toBe("skill-1");
    expect(skill.hidden).toBe(false);
    expect(skill.level).toBe(0);
  });

  it("updates education description when school matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const edu = result.sections.education.items[0];
    expect(edu.description).toContain("Graduated with honours.");
  });

  it("preserves education id, degree, area and period", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const edu = result.sections.education.items[0];
    expect(edu.id).toBe("edu-1");
    expect(edu.degree).toBe("BSc");
    expect(edu.area).toBe("CS");
    expect(edu.period).toBe("2010-2014");
  });

  it("updates project name and description when title matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const proj = result.sections.projects.items[0];
    expect(proj.name).toBe("My Side Project");
    expect(proj.description).toContain("A small tool for developers.");
    expect(proj.description).toContain("<strong>Tech Stack:</strong> TypeScript, Vite");
  });

  it("preserves project id, hidden flag and period", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const proj = result.sections.projects.items[0];
    expect(proj.id).toBe("proj-1");
    expect(proj.hidden).toBe(false);
    expect(proj.period).toBe("");
  });

  it("updates certification title, issuer and description when title matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const certItem = result.sections.certifications.items[0];
    expect(certItem.title).toBe("AWS Solutions Architect");
    expect(certItem.issuer).toBe("Amazon");
    expect(certItem.description).toBe("<p>Credential ID: AWS-12345</p>");
  });

  it("updates language fluency when language name matches", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const english = result.sections.languages.items[0];
    const dutch = result.sections.languages.items[1];
    expect(english.fluency).toBe("Full Professional Proficiency");
    expect(dutch.fluency).toBe("Conversational");
  });

  it("preserves language id, level and language name", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const english = result.sections.languages.items[0];
    expect(english.id).toBe("lang-1");
    expect(english.level).toBe(5);
    expect(english.language).toBe("English");
  });

  it("updates interest names from the dot-separated interests text", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const names = result.sections.interests.items.map((i) => i.name);
    expect(names).toContain("Cycling");
    expect(names).toContain("Travel");
  });

  it("preserves interest id and hidden flag", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    const interest = result.sections.interests.items[0];
    expect(interest.id).toBeDefined();
    expect(interest.hidden).toBe(false);
  });

  it("preserves metadata entirely", () => {
    const result = patchResumeJson(minimalCv, structuredClone(minimalJson)) as typeof minimalJson;
    expect(result.metadata).toEqual({ template: "lapras", colors: { primary: "red" } });
  });

  it("does not crash when a JSON experience item has no matching company in en.md", () => {
    const jsonWithExtra = structuredClone(minimalJson);
    jsonWithExtra.sections.experience.items.push({
      id: "exp-99",
      hidden: false,
      company: "Unknown Corp",
      position: "Some Role",
      location: "Nowhere",
      period: "2000",
      description: "<p>untouched</p>",
      roles: [],
      website: { url: "", label: "", inlineLink: false },
    });
    expect(() => patchResumeJson(minimalCv, jsonWithExtra)).not.toThrow();
  });

  it("leaves unmatched JSON experience items unchanged", () => {
    const jsonWithExtra = structuredClone(minimalJson);
    jsonWithExtra.sections.experience.items.push({
      id: "exp-99",
      hidden: false,
      company: "Unknown Corp",
      position: "Some Role",
      location: "Nowhere",
      period: "2000",
      description: "<p>untouched</p>",
      roles: [],
      website: { url: "", label: "", inlineLink: false },
    });
    const result = patchResumeJson(minimalCv, jsonWithExtra) as typeof jsonWithExtra;
    const unknown = result.sections.experience.items.find((i) => i.company === "Unknown Corp");
    expect(unknown?.description).toBe("<p>untouched</p>");
  });
});
