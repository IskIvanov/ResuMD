import { describe, it, expect } from "vitest";
import {
  parseSummary,
  parseExperience,
  parseSkills,
  parseEducation,
} from "./parser.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUMMARY_FIXTURE = `
## Summary

Senior engineer with 9+ years shipping products.

---

## Experience
`.trim();

const EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

**Senior Engineer** | 01/2023 – Present

Acme Corp builds widgets.

- Led end-to-end development of the widget platform.

- Built real-time data pipelines using GraphQL.

**Tech Stack:** React, TypeScript, GraphQL

---

### Beta Inc — Utrecht

**Engineer** | 01/2021 – 12/2022

- Owned the returns micro-frontend.

**Tech Stack:** React, Java

---

## Technical Skills
`.trim();

const NO_ROLE_EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

- Led end-to-end development of the widget platform.
`.trim();

// Mirrors Resume.md after Prettier hard-wraps long lines at 80 chars:
// bullet continuations are indented by 2 spaces, paragraphs are not indented.
const WRAPPED_EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

**Senior Engineer** | 01/2023 – Present

- Extended Energy Per Unit, an efficiency metric industrial customers use to
  benchmark production against energy use
- Built a near-real-time mode for energy monitoring dashboards

**Tech Stack:** React, TypeScript, GraphQL, Node.js, Jest, ApexCharts,
Highcharts, Styled Components

https://acme.example/

---

### Beta Inc — Utrecht

**Engineer** | 01/2021 – 12/2022

- Architected full-stack solutions across React frontends and Java/AEM backends
  for enterprise e-commerce platforms

- Collaborated across distributed EU teams in Agile/Scrum environments,
  providing technical depth in both frontend and backend domains

**Tech Stack:** React, Java

---

## Technical Skills
`.trim();

const SKILLS_FIXTURE = `
## Technical Skills

**Languages:** TypeScript, JavaScript, Python

**Frontend:** React, Next.js, Vue.js
`.trim();

const EDUCATION_FIXTURE = `
## Education

### University A — Springfield

**Master's degree, Engineering** | 2018 – 2019

Coursework completed; transitioned to full-time role.

- LINK101 Course Title Here
- Plain bullet without link

### University B

**Bachelor's, Computer Science** | 2012 – 2016

85% Overall Average

- Thesis: My Research Project
`.trim();

// ─── parseSummary ─────────────────────────────────────────────────────────────

describe("parseSummary", () => {
  it("extracts the summary body text", () => {
    const result = parseSummary(SUMMARY_FIXTURE);
    expect(result).toBe("Senior engineer with 9+ years shipping products.");
  });

  it("throws if ## Summary is missing", () => {
    expect(() => parseSummary("## Experience\n\nsome content")).toThrow(
      "Missing ## Summary",
    );
  });
});

// ─── parseExperience ──────────────────────────────────────────────────────────

describe("parseExperience", () => {
  it("returns one job per ### block", () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs).toHaveLength(2);
  });

  it('extracts company name (before " — ")', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].company).toBe("Acme Corp");
    expect(jobs[1].company).toBe("Beta Inc");
  });

  it('extracts role (bold text before " | ")', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].role).toBe("Senior Engineer");
    expect(jobs[1].role).toBe("Engineer");
  });

  it("returns an empty role when the role line is missing", () => {
    const jobs = parseExperience(NO_ROLE_EXPERIENCE_FIXTURE);
    expect(jobs[0].role).toBe("");
  });

  it('extracts bullets (strips leading "- ")', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].bullets).toEqual([
      "Led end-to-end development of the widget platform.",
      "Built real-time data pipelines using GraphQL.",
    ]);
  });

  it('extracts stack (strips "**Tech Stack:** " prefix)', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].stack).toBe("React, TypeScript, GraphQL");
  });

  it("handles job with no context paragraph", () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[1].bullets).toEqual(["Owned the returns micro-frontend."]);
  });

  it("joins hard-wrapped bullet continuation lines into one bullet", () => {
    const jobs = parseExperience(WRAPPED_EXPERIENCE_FIXTURE);
    expect(jobs[0].bullets).toEqual([
      "Extended Energy Per Unit, an efficiency metric industrial customers use to benchmark production against energy use",
      "Built a near-real-time mode for energy monitoring dashboards",
    ]);
  });

  it("joins hard-wrapped bullets separated by blank lines", () => {
    const jobs = parseExperience(WRAPPED_EXPERIENCE_FIXTURE);
    expect(jobs[1].bullets).toEqual([
      "Architected full-stack solutions across React frontends and Java/AEM backends for enterprise e-commerce platforms",
      "Collaborated across distributed EU teams in Agile/Scrum environments, providing technical depth in both frontend and backend domains",
    ]);
  });

  it("joins a hard-wrapped Tech Stack line", () => {
    const jobs = parseExperience(WRAPPED_EXPERIENCE_FIXTURE);
    expect(jobs[0].stack).toBe(
      "React, TypeScript, GraphQL, Node.js, Jest, ApexCharts, Highcharts, Styled Components",
    );
  });
});

// ─── parseSkills ──────────────────────────────────────────────────────────────

describe("parseSkills", () => {
  it("returns one group per **Heading:** line", () => {
    const groups = parseSkills(SKILLS_FIXTURE);
    expect(groups).toHaveLength(2);
  });

  it("extracts heading", () => {
    const groups = parseSkills(SKILLS_FIXTURE);
    expect(groups[0].heading).toBe("Languages");
    expect(groups[1].heading).toBe("Frontend");
  });

  it('splits items by ", "', () => {
    const groups = parseSkills(SKILLS_FIXTURE);
    expect(groups[0].items).toEqual(["TypeScript", "JavaScript", "Python"]);
  });

  it("includes items from hard-wrapped continuation lines", () => {
    const groups = parseSkills(
      "## Technical Skills\n\n**Frontend:** React, Next.js, Styled Components,\nMaterial UI\n\n**Languages:** Java",
    );
    expect(groups).toEqual([
      {
        heading: "Frontend",
        items: ["React", "Next.js", "Styled Components", "Material UI"],
      },
      { heading: "Languages", items: ["Java"] },
    ]);
  });
});

// ─── parseEducation ───────────────────────────────────────────────────────────

describe("parseEducation", () => {
  it("returns one item per ### block", () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items).toHaveLength(2);
  });

  it('extracts school name (before " — " if present)', () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items[0].school).toBe("University A");
    expect(items[1].school).toBe("University B");
  });

  it("extracts context (line after degree, before bullets)", () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items[0].context).toBe(
      "Coursework completed; transitioned to full-time role.",
    );
    expect(items[1].context).toBe("85% Overall Average");
  });

  it('extracts bullets as plain text (strips "- " prefix)', () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items[0].bullets).toEqual([
      "LINK101 Course Title Here",
      "Plain bullet without link",
    ]);
  });

  it("joins hard-wrapped bullet continuation lines into one bullet", () => {
    const items = parseEducation(
      [
        "## Education",
        "",
        "### University A — Springfield",
        "",
        "**Master's degree, Engineering** | 2018 – 2019",
        "",
        "- ESMM290 Software Systems Architecture (in collaboration with Carnegie Mellon",
        "  University)",
        "- CS101 Software Engineering",
      ].join("\n"),
    );
    expect(items[0].bullets).toEqual([
      "ESMM290 Software Systems Architecture (in collaboration with Carnegie Mellon University)",
      "CS101 Software Engineering",
    ]);
  });
});
