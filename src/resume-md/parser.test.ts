import { describe, it, expect } from "vitest";
import type { ResumeMd } from "./types.ts";
import { parseResumeMd } from "./parser.ts";

// ─── Fixtures: sections ───────────────────────────────────────────────────────
//
// Each fixture is one self-contained part of Resume.md; buildResume joins them
// into a resume that passes validation, so a test swaps out only the part it
// is about.

const HEADER_FIXTURE = `
# Jane Doe

**Software Engineer**

jane.doe@example.com | +31 6 12345678 | City, Country | example.com
LinkedIn | GitHub
`.trim();

const SUMMARY_FIXTURE = `
## Summary

Senior engineer with 9+ years shipping products.
`.trim();

const EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

**Senior Engineer** | 01/2023 – Present

Acme Corp builds widgets.

- Led end-to-end development of the widget platform.

- Built real-time data pipelines using GraphQL.

**Tech Stack:** React, TypeScript, GraphQL

**Reference:** manager@acme.example, lead@acme.example

---

### Beta Inc — Utrecht

**Engineer** | 01/2021 – 12/2022

- Owned the returns micro-frontend.

**Tech Stack:** React, Java
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

const PROJECTS_FIXTURE = `
## Projects

### Widget Dashboard

A small example that streams widget prices in real time, built to try out
server-sent events.

**Tech Stack:** Next.js, React, Server Sent Events (provided by
Next.js)

GitHub

### Acme Tools — Prototype

Prototype UI.

**Tech Stack:** React

GitHub | Demo
`.trim();

const CERTIFICATIONS_FIXTURE = `
## Certifications

### Example Security Essentials — Example Issuer

Covers threat modelling and secure
defaults.

**Credential ID:** EX-0001,
EX-0002

[Credential](https://example.com/cert/EX-0001)

### Plain Certificate — Other Issuer
`.trim();

const LANGUAGES_FIXTURE = `
## Languages

- English — Full Professional Proficiency
- Dutch — Conversational (actively studying)
- Esperanto
`.trim();

const INTERESTS_FIXTURE = `
## Interests

Cycling · Weightlifting · Travel

---

References available upon request
`.trim();

/** The parts of a valid resume, in document order. */
const RESUME_PARTS = {
  header: HEADER_FIXTURE,
  summary: SUMMARY_FIXTURE,
  experience: EXPERIENCE_FIXTURE,
  skills: SKILLS_FIXTURE,
  education: EDUCATION_FIXTURE,
  projects: PROJECTS_FIXTURE,
  certifications: CERTIFICATIONS_FIXTURE,
  languages: LANGUAGES_FIXTURE,
  interests: INTERESTS_FIXTURE,
  references: "",
};
type ResumeParts = typeof RESUME_PARTS;

/**
 * A resume with every required section, parts separated by rules. An empty
 * override leaves that part out.
 */
function buildResume(overrides: Partial<ResumeParts> = {}): string {
  return Object.values({ ...RESUME_PARTS, ...overrides })
    .filter((part) => part.length > 0)
    .join("\n\n---\n\n");
}

/** Parses a resume built from the default parts and the overrides. */
function parseWith(overrides: Partial<ResumeParts> = {}): ResumeMd {
  return parseResumeMd(buildResume(overrides));
}

// ─── Fixtures: variants ───────────────────────────────────────────────────────

const PLAIN_REFERENCE_EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

**Senior Engineer** | 01/2023 – Present

**Tech Stack:** React, TypeScript

Reference: manager@acme.example, lead@acme.example
`.trim();

const UNSPACED_REFERENCE_EXPERIENCE_FIXTURE = `
## Experience

### Acme Corp — Amsterdam

**Senior Engineer** | 01/2023 – Present

**Tech Stack:** React, TypeScript
**Reference:** manager@acme.example, lead@acme.example
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
`.trim();

const LINKED_HEADER_FIXTURE = `
# Jane Doe

**Software Engineer**

jane.doe@example.com | City, Country | example.com
[LinkedIn](https://linkedin.com/in/jane-doe) | [GitHub](https://github.com/jane-doe)
`.trim();

const LINKED_PROJECTS_FIXTURE = `
## Projects

### Widget Dashboard

Streams widget prices in real time.

**Tech Stack:** Next.js, React

[GitHub](https://github.com/jane-doe/widgets) | [Demo](https://widgets.example/)

### Linked Only

[GitHub](https://github.com/jane-doe/linked-only)

### Plain Labels

Prototype UI.

GitHub | Demo

### Relative Link

Thesis write-up.

[Thesis](/doc/thesis.pdf) | [Slides](http://slides.example/)
`.trim();

const INTERESTS_WITHOUT_NOTE_FIXTURE = `
## Interests

Cycling · Weightlifting · Travel
`.trim();

// ─── parseResumeMd ──────────────────────────────────────────────────────────────

describe("parseResumeMd", () => {
  it("parses every section of a full resume", () => {
    const resumeMd = parseWith();

    expect(resumeMd.header.name).toBe("Jane Doe");
    expect(resumeMd.summary).toBe(
      "Senior engineer with 9+ years shipping products.",
    );
    expect(resumeMd.jobs).toHaveLength(2);
    expect(resumeMd.skillGroups).toHaveLength(2);
    expect(resumeMd.schools).toHaveLength(2);
    expect(resumeMd.projects).toHaveLength(2);
    expect(resumeMd.certifications).toHaveLength(2);
    expect(resumeMd.languages).toHaveLength(3);
    expect(resumeMd.interests).toHaveLength(3);
    expect(resumeMd.references).toHaveLength(1);
  });

  // ─── Header ─────────────────────────────────────────────────────────────────

  describe("header", () => {
    it("reads the name from the # heading", () => {
      expect(parseWith().header.name).toBe("Jane Doe");
    });

    it("reads the headline from the bold line", () => {
      expect(parseWith().header.headline).toBe("Software Engineer");
    });

    it("classifies the contact line into email, phone, location and website", () => {
      expect(parseWith().header).toMatchObject({
        email: "jane.doe@example.com",
        phone: "+31 6 12345678",
        location: "City, Country",
        website: "example.com",
      });
    });

    it("leaves phone empty when the phone has invalid characters", () => {
      const header = HEADER_FIXTURE.replace("+31 6 12345678", "+31 6 123s5678");
      expect(parseWith({ header }).header.phone).toBe("");
    });

    it("classifies contact parts regardless of their order", () => {
      const header =
        "# Jane Doe\n\n**Engineer**\n\nhttps://example.com/me | City | jane@example.com";
      expect(parseWith({ header }).header).toMatchObject({
        email: "jane@example.com",
        phone: "",
        location: "City",
        website: "https://example.com/me",
      });
    });

    it("reads header links as profiles", () => {
      const header = LINKED_HEADER_FIXTURE;
      expect(parseWith({ header }).header.profiles).toEqual([
        { label: "LinkedIn", url: "https://linkedin.com/in/jane-doe" },
        { label: "GitHub", url: "https://github.com/jane-doe" },
      ]);
    });

    it("returns no profiles for plain labels without URLs", () => {
      expect(parseWith().header.profiles).toEqual([]);
    });

    it("keeps links on the contact line out of the contact details", () => {
      const header =
        "# Jane Doe\n\n**Engineer**\n\njane@example.com | [GitHub](https://github.com/jane) | City";
      expect(parseWith({ header }).header).toMatchObject({
        email: "jane@example.com",
        location: "City",
        website: "",
        profiles: [{ label: "GitHub", url: "https://github.com/jane" }],
      });
    });

    it("does not pick up links from the sections below the header", () => {
      const projects = LINKED_PROJECTS_FIXTURE;
      expect(parseWith({ projects }).header.profiles).toEqual([]);
    });

    it("throws if the email in the header is invalid", () => {
      const header = HEADER_FIXTURE.replace(
        "jane.doe@example.com",
        "jane.doe@",
      );
      expect(() => parseWith({ header })).toThrow(
        "header.email: invalid email format",
      );
    });

    it("throws if the phone has a character the schema refuses", () => {
      const header = HEADER_FIXTURE.replace(
        "+31 6 12345678",
        "+31 (6) 1234.5678",
      );
      expect(() => parseWith({ header })).toThrow(
        "header.phone: invalid phone number format",
      );
    });

    it("throws if the header is missing", () => {
      expect(() => parseWith({ header: "" })).toThrow(
        "header.email: invalid email format",
      );
    });
  });

  // ─── Summary ────────────────────────────────────────────────────────────────

  describe("## Summary", () => {
    it("reads the summary body text", () => {
      expect(parseWith().summary).toBe(
        "Senior engineer with 9+ years shipping products.",
      );
    });

    it("joins hard-wrapped lines and paragraphs into one line", () => {
      const summary = [
        "## Summary",
        "",
        "Senior engineer with 9+ years shipping products, from API design to",
        "the interface people use every day.",
        "",
        "Based in Amsterdam.",
      ].join("\n");
      expect(parseWith({ summary }).summary).toBe(
        "Senior engineer with 9+ years shipping products, from API design to the interface people use every day. Based in Amsterdam.",
      );
    });

    it("throws if ## Summary is missing", () => {
      expect(() => parseWith({ summary: "" })).toThrow("summary: required");
    });
  });

  // ─── Experience ─────────────────────────────────────────────────────────────

  describe("## Experience", () => {
    it("returns one job per ### block", () => {
      expect(parseWith().jobs).toHaveLength(2);
    });

    it('reads company and location from the "Company — Location" heading', () => {
      const { jobs } = parseWith();
      expect(jobs[0]).toMatchObject({
        company: "Acme Corp",
        location: "Amsterdam",
      });
      expect(jobs[1]).toMatchObject({
        company: "Beta Inc",
        location: "Utrecht",
      });
    });

    it('reads role and period from the "**Role** | period" line', () => {
      const { jobs } = parseWith();
      expect(jobs[0]).toMatchObject({
        role: "Senior Engineer",
        period: "01/2023 – Present",
      });
      expect(jobs[1]).toMatchObject({
        role: "Engineer",
        period: "01/2021 – 12/2022",
      });
    });

    it("reads the intro paragraph after the role line", () => {
      expect(parseWith().jobs[0].intro).toBe("Acme Corp builds widgets.");
    });

    it("returns an empty intro when the job has no paragraph", () => {
      const { jobs } = parseWith({ experience: WRAPPED_EXPERIENCE_FIXTURE });
      expect(jobs[0].intro).toBe("");
      expect(jobs[1].intro).toBe("");
    });

    it('reads bullets without the leading "- "', () => {
      expect(parseWith().jobs[0].bullets).toEqual([
        "Led end-to-end development of the widget platform.",
        "Built real-time data pipelines using GraphQL.",
      ]);
    });

    it("finds the bullets of a job without an intro paragraph", () => {
      expect(parseWith().jobs[1].bullets).toEqual([
        "Owned the returns micro-frontend.",
      ]);
    });

    it('reads the tech stack without the "**Tech Stack:**" label', () => {
      expect(parseWith().jobs[0].techStack).toBe("React, TypeScript, GraphQL");
    });

    it("reads the company website from a bare URL line", () => {
      const { jobs } = parseWith({ experience: WRAPPED_EXPERIENCE_FIXTURE });
      expect(jobs[0].website).toBe("https://acme.example/");
      expect(jobs[1].website).toBe("");
    });

    it("joins hard-wrapped bullet continuation lines into one bullet", () => {
      const { jobs } = parseWith({ experience: WRAPPED_EXPERIENCE_FIXTURE });
      expect(jobs[0].bullets).toEqual([
        "Extended Energy Per Unit, an efficiency metric industrial customers use to benchmark production against energy use",
        "Built a near-real-time mode for energy monitoring dashboards",
      ]);
    });

    it("joins hard-wrapped bullets separated by blank lines", () => {
      const { jobs } = parseWith({ experience: WRAPPED_EXPERIENCE_FIXTURE });
      expect(jobs[1].bullets).toEqual([
        "Architected full-stack solutions across React frontends and Java/AEM backends for enterprise e-commerce platforms",
        "Collaborated across distributed EU teams in Agile/Scrum environments, providing technical depth in both frontend and backend domains",
      ]);
    });

    it("joins a hard-wrapped Tech Stack line", () => {
      const { jobs } = parseWith({ experience: WRAPPED_EXPERIENCE_FIXTURE });
      expect(jobs[0].techStack).toBe(
        "React, TypeScript, GraphQL, Node.js, Jest, ApexCharts, Highcharts, Styled Components",
      );
    });

    it("throws if a job has no role line", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "**Engineer** | 01/2021 – 12/2022\n",
        "",
      );
      const parse = (): unknown => parseWith({ experience });
      expect(parse).toThrow("jobs[1].role: required");
      expect(parse).toThrow("jobs[1].period: required");
    });

    it("throws if a job has no tech stack line", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "\n\n**Tech Stack:** React, Java",
        "",
      );
      expect(() => parseWith({ experience })).toThrow(
        "jobs[1].techStack: required",
      );
    });

    it("throws if ## Experience is missing", () => {
      expect(() => parseWith({ experience: "" })).toThrow(
        "jobs: needs at least one entry",
      );
    });
  });

  // ─── Experience: job references ─────────────────────────────────────────────

  describe("## Experience job references", () => {
    it('splits the "**Reference:**" line into its references on ","', () => {
      expect(parseWith().jobs[0].references).toEqual([
        "manager@acme.example",
        "lead@acme.example",
      ]);
    });

    it("leaves the references undefined when a job has no reference line", () => {
      expect(parseWith().jobs[1]).not.toHaveProperty("references");
    });

    it('reads a "Reference:" line written without bold', () => {
      const experience = PLAIN_REFERENCE_EXPERIENCE_FIXTURE;
      expect(parseWith({ experience }).jobs[0].references).toEqual([
        "manager@acme.example",
        "lead@acme.example",
      ]);
    });

    it('does not take a plain "Reference:" line as the intro', () => {
      const experience = PLAIN_REFERENCE_EXPERIENCE_FIXTURE;
      expect(parseWith({ experience }).jobs[0].intro).toBe("");
    });

    it.each([
      "**Reference**: manager@acme.example, lead@acme.example",
      "**References:** manager@acme.example, lead@acme.example",
      "References: manager@acme.example, lead@acme.example",
      "reference: manager@acme.example, lead@acme.example",
    ])("reads the references, not the intro, from %j", (line) => {
      const experience = PLAIN_REFERENCE_EXPERIENCE_FIXTURE.replace(
        "Reference: manager@acme.example, lead@acme.example",
        line,
      );
      const [job] = parseWith({ experience }).jobs;
      expect(job.references).toEqual([
        "manager@acme.example",
        "lead@acme.example",
      ]);
      expect(job.intro).toBe("");
    });

    it("reads a reference line written right under the tech stack", () => {
      const experience = UNSPACED_REFERENCE_EXPERIENCE_FIXTURE;
      const [job] = parseWith({ experience }).jobs;
      expect(job.techStack).toBe("React, TypeScript");
      expect(job.references).toEqual([
        "manager@acme.example",
        "lead@acme.example",
      ]);
    });

    it("throws if a job's reference is not an email", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "lead@acme.example",
        "Jane Lead",
      );
      expect(() => parseWith({ experience })).toThrow(
        "jobs[0].references[1]: invalid email format",
      );
    });

    it("throws if a job's reference line is empty", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "manager@acme.example, lead@acme.example",
        "",
      );
      expect(() => parseWith({ experience })).toThrow(
        "jobs[0].references: needs at least one entry",
      );
    });

    it("throws if a job lists the same reference twice", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "lead@acme.example",
        "manager@acme.example",
      );
      expect(() => parseWith({ experience })).toThrow(
        "jobs[0].references: has duplicate entries",
      );
    });

    it("throws if a job has more than two references", () => {
      const experience = EXPERIENCE_FIXTURE.replace(
        "lead@acme.example",
        "lead@acme.example, cto@acme.example",
      );
      expect(() => parseWith({ experience })).toThrow(
        "jobs[0].references: at most 2 entries",
      );
    });
  });

  // ─── Technical Skills ───────────────────────────────────────────────────────

  describe("## Technical Skills", () => {
    it('returns one group per "**Label:** a, b" line', () => {
      expect(parseWith().skillGroups).toEqual([
        { label: "Languages", skills: ["TypeScript", "JavaScript", "Python"] },
        { label: "Frontend", skills: ["React", "Next.js", "Vue.js"] },
      ]);
    });

    it("includes skills from hard-wrapped continuation lines", () => {
      const skills =
        "## Technical Skills\n\n**Frontend:** React, Next.js, Styled Components,\nMaterial UI\n\n**Languages:** Java";
      expect(parseWith({ skills }).skillGroups).toEqual([
        {
          label: "Frontend",
          skills: ["React", "Next.js", "Styled Components", "Material UI"],
        },
        { label: "Languages", skills: ["Java"] },
      ]);
    });

    it("throws if ## Technical Skills is missing", () => {
      expect(() => parseWith({ skills: "" })).toThrow(
        "skillGroups: needs at least one entry",
      );
    });
  });

  // ─── Education ──────────────────────────────────────────────────────────────

  describe("## Education", () => {
    it("returns one school per ### block", () => {
      expect(parseWith().schools).toHaveLength(2);
    });

    it('reads school and location from the heading, location empty without " — "', () => {
      const { schools } = parseWith();
      expect(schools[0]).toMatchObject({
        school: "University A",
        location: "Springfield",
      });
      expect(schools[1]).toMatchObject({
        school: "University B",
        location: "",
      });
    });

    it("reads degree, area and period from the degree line", () => {
      expect(parseWith().schools[0]).toMatchObject({
        degree: "Master's degree",
        area: "Engineering",
        period: "2018 – 2019",
      });
    });

    it("reads the intro line after the degree, before the bullets", () => {
      const { schools } = parseWith();
      expect(schools[0].intro).toBe(
        "Coursework completed; transitioned to full-time role.",
      );
      expect(schools[1].intro).toBe("85% Overall Average");
    });

    it('reads bullets as plain text without the leading "- "', () => {
      expect(parseWith().schools[0].bullets).toEqual([
        "LINK101 Course Title Here",
        "Plain bullet without link",
      ]);
    });

    it("joins hard-wrapped bullet continuation lines into one bullet", () => {
      const education = [
        "## Education",
        "",
        "### University A — Springfield",
        "",
        "**Master's degree, Engineering** | 2018 – 2019",
        "",
        "- ESMM290 Software Systems Architecture (in collaboration with Carnegie Mellon",
        "  University)",
        "- CS101 Software Engineering",
      ].join("\n");
      expect(parseWith({ education }).schools[0].bullets).toEqual([
        "ESMM290 Software Systems Architecture (in collaboration with Carnegie Mellon University)",
        "CS101 Software Engineering",
      ]);
    });

    it("throws if ## Education is missing", () => {
      expect(() => parseWith({ education: "" })).toThrow(
        "schools: needs at least one entry",
      );
    });

    it("throws if a school has no degree line", () => {
      const education = EDUCATION_FIXTURE.replace(
        "**Master's degree, Engineering** | 2018 – 2019\n",
        "",
      );
      expect(() => parseWith({ education })).toThrow(
        "schools[0].degree: required",
      );
    });
  });

  // ─── Projects ───────────────────────────────────────────────────────────────

  describe("## Projects", () => {
    it("returns one project per ### block", () => {
      expect(parseWith().projects).toHaveLength(2);
    });

    it('keeps the full heading as the title, including " — "', () => {
      const { projects } = parseWith();
      expect(projects[0].title).toBe("Widget Dashboard");
      expect(projects[1].title).toBe("Acme Tools — Prototype");
    });

    it("joins the hard-wrapped intro paragraph", () => {
      expect(parseWith().projects[0].intro).toBe(
        "A small example that streams widget prices in real time, built to try out server-sent events.",
      );
    });

    it("joins the hard-wrapped Tech Stack line", () => {
      expect(parseWith().projects[0].techStack).toBe(
        "Next.js, React, Server Sent Events (provided by Next.js)",
      );
    });

    it("reads every markdown link of a project as label and url", () => {
      const { projects } = parseWith({ projects: LINKED_PROJECTS_FIXTURE });
      expect(projects[0].links).toEqual([
        { label: "GitHub", url: "https://github.com/jane-doe/widgets" },
        { label: "Demo", url: "https://widgets.example/" },
      ]);
    });

    it("returns no links for plain labels without URLs", () => {
      const { projects } = parseWith({ projects: LINKED_PROJECTS_FIXTURE });
      expect(projects[2].links).toEqual([]);
    });

    it("ignores links without an http(s) URL", () => {
      const { projects } = parseWith({ projects: LINKED_PROJECTS_FIXTURE });
      expect(projects[3].links).toEqual([
        { label: "Slides", url: "http://slides.example/" },
      ]);
    });

    it("does not mistake a link line for the intro paragraph", () => {
      const { projects } = parseWith({ projects: LINKED_PROJECTS_FIXTURE });
      expect(projects[1].intro).toBe("");
      expect(projects[1].links).toHaveLength(1);
    });

    it("returns an empty list when the section is missing", () => {
      expect(parseWith({ projects: "" }).projects).toEqual([]);
    });
  });

  // ─── Certifications ─────────────────────────────────────────────────────────

  describe("## Certifications", () => {
    it("reads title and issuer from a `### Title — Issuer` heading alone", () => {
      expect(parseWith().certifications[1]).toEqual({
        title: "Plain Certificate",
        issuer: "Other Issuer",
        description: "",
        credentialIds: [],
      });
    });

    it("reads the description from the paragraph under the heading", () => {
      expect(parseWith().certifications[0].description).toBe(
        "Covers threat modelling and secure defaults.",
      );
    });

    it("reads credential ids from a hard-wrapped **Credential ID:** line", () => {
      expect(parseWith().certifications[0].credentialIds).toEqual([
        "EX-0001",
        "EX-0002",
      ]);
    });

    it("reads the link from a markdown link line", () => {
      expect(parseWith().certifications[0].link).toEqual({
        label: "Credential",
        url: "https://example.com/cert/EX-0001",
      });
    });

    it("throws when a heading has no issuer", () => {
      const certifications = "## Certifications\n\n### Plain Certificate";
      expect(() => parseWith({ certifications })).toThrow(
        "certifications[0].issuer: required",
      );
    });

    it("returns an empty list when the section is missing", () => {
      expect(parseWith({ certifications: "" }).certifications).toEqual([]);
    });
  });

  // ─── Languages ──────────────────────────────────────────────────────────────

  describe("## Languages", () => {
    it('splits each bullet into language and fluency on " — "', () => {
      expect(parseWith().languages).toEqual([
        {
          language: "English",
          fluency: "Full Professional Proficiency",
          level: 0,
        },
        {
          language: "Dutch",
          fluency: "Conversational (actively studying)",
          level: 0,
        },
        { language: "Esperanto", fluency: "", level: 0 },
      ]);
    });

    it("returns an empty list when the section is missing", () => {
      expect(parseWith({ languages: "" }).languages).toEqual([]);
    });

    it("reads a numeric qualifier as the level", () => {
      const languages = "## Languages\n\n- English — 5\n- Dutch — 3";
      expect(parseWith({ languages }).languages).toEqual([
        { language: "English", fluency: "", level: 5 },
        { language: "Dutch", fluency: "", level: 3 },
      ]);
    });

    it("reads a trailing (n/5) as the level after the fluency", () => {
      const languages = [
        "## Languages",
        "",
        "- English — Native (5/5)",
        "- Dutch — Conversational (actively studying) (3/5)",
      ].join("\n");
      expect(parseWith({ languages }).languages).toEqual([
        { language: "English", fluency: "Native", level: 5 },
        {
          language: "Dutch",
          fluency: "Conversational (actively studying)",
          level: 3,
        },
      ]);
    });
  });

  // ─── Interests ──────────────────────────────────────────────────────────────

  describe("## Interests", () => {
    it('splits the line on " · " and stops at the rule', () => {
      expect(parseWith().interests).toEqual([
        "Cycling",
        "Weightlifting",
        "Travel",
      ]);
    });

    it("keeps an interest whole when the line is hard-wrapped inside it", () => {
      const interests =
        "## Interests\n\nCycling · Long Distance\nHiking · Travel";
      expect(parseWith({ interests }).interests).toEqual([
        "Cycling",
        "Long Distance Hiking",
        "Travel",
      ]);
    });

    it("returns an empty list when the section is missing", () => {
      expect(parseWith({ interests: "" }).interests).toEqual([]);
    });
  });

  // ─── References ─────────────────────────────────────────────────────────────

  describe("references", () => {
    it("picks up a trailing References note without a heading", () => {
      expect(parseWith().references).toEqual([
        "References available upon request",
      ]);
    });

    it("reads each line of a ## References section", () => {
      const references = "## References\n\n- Ada Lovelace\n- Alan Turing";
      expect(parseWith({ references }).references).toEqual([
        "Ada Lovelace",
        "Alan Turing",
      ]);
    });

    it("returns an empty list when there are no references", () => {
      const interests = INTERESTS_WITHOUT_NOTE_FIXTURE;
      expect(parseWith({ interests }).references).toEqual([]);
    });

    it("ignores a job's References line without a heading", () => {
      const experience = PLAIN_REFERENCE_EXPERIENCE_FIXTURE.replace(
        "Reference:",
        "References:",
      );
      const interests = INTERESTS_WITHOUT_NOTE_FIXTURE;
      expect(parseWith({ experience, interests }).references).toEqual([]);
    });
  });
});
