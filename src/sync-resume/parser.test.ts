import { describe, it, expect } from "vitest";
import {
  parseBasics,
  parseSummary,
  parseExperience,
  parseSkills,
  parseEducation,
  parseProjects,
  parseCertifications,
  parseLanguages,
  parseInterests,
  parseLinks,
  parseReferences,
  parseResume,
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

// ─── Fixtures: header and trailing sections ───────────────────────────────────

const HEADER_FIXTURE = `
# Jane Doe

**Software Engineer**

jane.doe@example.com | +31 6 12345678 | City, Country | example.com
LinkedIn | GitHub

---

## Summary

Senior engineer.
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

---

## Certifications
`.trim();

const CERTIFICATIONS_FIXTURE = `
## Certifications

**Example Security Essentials** Example Issuer Credential ID:
EX-0001, EX-0002

**Plain Certificate** Other Issuer

---

## Languages
`.trim();

const FOOTER_FIXTURE = `
## Languages

- English — Full Professional Proficiency
- Dutch — Conversational (actively studying)
- Esperanto

---

## Interests

Cycling · Weightlifting · Travel

---

References available upon request
`.trim();

// ─── parseBasics ──────────────────────────────────────────────────────────────

describe("parseBasics", () => {
  it("extracts the name from the # heading", () => {
    expect(parseBasics(HEADER_FIXTURE).name).toBe("Jane Doe");
  });

  it("extracts the headline from the bold line", () => {
    expect(parseBasics(HEADER_FIXTURE).headline).toBe("Software Engineer");
  });

  it("classifies the contact line into email, phone, location and website", () => {
    expect(parseBasics(HEADER_FIXTURE)).toMatchObject({
      email: "jane.doe@example.com",
      phone: "+31 6 12345678",
      location: "City, Country",
      website: "example.com",
    });
  });

  it("classifies contact parts regardless of their order", () => {
    const basics = parseBasics(
      "# Jane Doe\n\n**Engineer**\n\nhttps://example.com/me | City | jane@example.com",
    );
    expect(basics).toMatchObject({
      email: "jane@example.com",
      phone: "",
      location: "City",
      website: "https://example.com/me",
    });
  });

  it("returns empty strings when the header is missing", () => {
    expect(parseBasics("## Summary\n\nSenior engineer.")).toEqual({
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      profiles: [],
    });
  });
});

// ─── parseExperience: location, period, context, website ─────────────────────

describe("parseExperience details", () => {
  it('extracts location (after " — ")', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].location).toBe("Amsterdam");
  });

  it('extracts period (after " | " on the role line)', () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].period).toBe("01/2023 – Present");
    expect(jobs[1].period).toBe("01/2021 – 12/2022");
  });

  it("returns an empty period when the role line is missing", () => {
    expect(parseExperience(NO_ROLE_EXPERIENCE_FIXTURE)[0].period).toBe("");
  });

  it("extracts the context paragraph after the role line", () => {
    const jobs = parseExperience(EXPERIENCE_FIXTURE);
    expect(jobs[0].context).toBe("Acme Corp builds widgets.");
  });

  it("returns an empty context when the job has no paragraph", () => {
    const jobs = parseExperience(WRAPPED_EXPERIENCE_FIXTURE);
    expect(jobs[0].context).toBe("");
    expect(jobs[1].context).toBe("");
  });

  it("extracts the company website from a bare URL line", () => {
    const jobs = parseExperience(WRAPPED_EXPERIENCE_FIXTURE);
    expect(jobs[0].website).toBe("https://acme.example/");
    expect(jobs[1].website).toBe("");
  });
});

// ─── parseEducation: location, degree, period ─────────────────────────────────

describe("parseEducation details", () => {
  it("extracts degree and period from the degree line", () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items[0].degree).toBe("Master's degree, Engineering");
    expect(items[0].period).toBe("2018 – 2019");
  });

  it("extracts location, empty when the heading has none", () => {
    const items = parseEducation(EDUCATION_FIXTURE);
    expect(items[0].location).toBe("Springfield");
    expect(items[1].location).toBe("");
  });
});

// ─── parseProjects ────────────────────────────────────────────────────────────

describe("parseProjects", () => {
  it("returns one project per ### block", () => {
    expect(parseProjects(PROJECTS_FIXTURE)).toHaveLength(2);
  });

  it('keeps the full heading as the title, including " — "', () => {
    const projects = parseProjects(PROJECTS_FIXTURE);
    expect(projects[0].title).toBe("Widget Dashboard");
    expect(projects[1].title).toBe("Acme Tools — Prototype");
  });

  it("joins the hard-wrapped context paragraph", () => {
    expect(parseProjects(PROJECTS_FIXTURE)[0].context).toBe(
      "A small example that streams widget prices in real time, built to try out server-sent events.",
    );
  });

  it("joins the hard-wrapped Tech Stack line", () => {
    expect(parseProjects(PROJECTS_FIXTURE)[0].stack).toBe(
      "Next.js, React, Server Sent Events (provided by Next.js)",
    );
  });

  it("returns an empty list when the section is missing", () => {
    expect(parseProjects(SKILLS_FIXTURE)).toEqual([]);
  });
});

// ─── parseCertifications ──────────────────────────────────────────────────────

describe("parseCertifications", () => {
  it("extracts title, issuer and credential ids", () => {
    expect(parseCertifications(CERTIFICATIONS_FIXTURE)[0]).toEqual({
      title: "Example Security Essentials",
      issuer: "Example Issuer",
      credentialIds: ["EX-0001", "EX-0002"],
    });
  });

  it("returns no credential ids when the line has none", () => {
    expect(parseCertifications(CERTIFICATIONS_FIXTURE)[1]).toEqual({
      title: "Plain Certificate",
      issuer: "Other Issuer",
      credentialIds: [],
    });
  });

  it("returns an empty list when the section is missing", () => {
    expect(parseCertifications(SKILLS_FIXTURE)).toEqual([]);
  });
});

// ─── parseLanguages ───────────────────────────────────────────────────────────

describe("parseLanguages", () => {
  it('splits each bullet into language and fluency on " — "', () => {
    expect(parseLanguages(FOOTER_FIXTURE)).toEqual([
      { language: "English", fluency: "Full Professional Proficiency" },
      { language: "Dutch", fluency: "Conversational (actively studying)" },
      { language: "Esperanto", fluency: "" },
    ]);
  });

  it("returns an empty list when the section is missing", () => {
    expect(parseLanguages(SKILLS_FIXTURE)).toEqual([]);
  });
});

// ─── parseInterests ───────────────────────────────────────────────────────────

describe("parseInterests", () => {
  it('splits the line on " · " and stops at the rule', () => {
    expect(parseInterests(FOOTER_FIXTURE)).toEqual([
      "Cycling",
      "Weightlifting",
      "Travel",
    ]);
  });

  it("returns an empty list when the section is missing", () => {
    expect(parseInterests(SKILLS_FIXTURE)).toEqual([]);
  });
});

// ─── parseReferences ──────────────────────────────────────────────────────────

describe("parseReferences", () => {
  it("picks up a trailing References note without a heading", () => {
    expect(parseReferences(FOOTER_FIXTURE)).toEqual([
      "References available upon request",
    ]);
  });

  it("reads each line of a ## References section", () => {
    expect(
      parseReferences("## References\n\n- Ada Lovelace\n- Alan Turing\n\n---"),
    ).toEqual(["Ada Lovelace", "Alan Turing"]);
  });

  it("returns an empty list when there are no references", () => {
    expect(parseReferences(SKILLS_FIXTURE)).toEqual([]);
  });
});

// ─── parseResume ──────────────────────────────────────────────────────────────

describe("parseResume", () => {
  it("parses every section of a full resume", () => {
    const parsed = parseResume(
      [
        HEADER_FIXTURE,
        "---",
        EXPERIENCE_FIXTURE,
        "---",
        EDUCATION_FIXTURE,
        "---",
        PROJECTS_FIXTURE,
        CERTIFICATIONS_FIXTURE.replace("## Certifications\n", ""),
        FOOTER_FIXTURE.replace("## Languages\n", ""),
      ].join("\n\n"),
    );

    expect(parsed.basics.name).toBe("Jane Doe");
    expect(parsed.summary).toBe("Senior engineer.");
    expect(parsed.jobs).toHaveLength(2);
    expect(parsed.eduItems).toHaveLength(2);
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.certifications).toHaveLength(2);
    expect(parsed.languages).toHaveLength(3);
    expect(parsed.interests).toHaveLength(3);
    expect(parsed.references).toHaveLength(1);
  });
});

// ─── Fixtures: links ──────────────────────────────────────────────────────────

const LINKED_HEADER_FIXTURE = `
# Jane Doe

**Software Engineer**

jane.doe@example.com | City, Country | example.com
[LinkedIn](https://linkedin.com/in/jane-doe) | [GitHub](https://github.com/jane-doe)

---

## Summary

Senior engineer.
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
`.trim();

// ─── parseLinks ───────────────────────────────────────────────────────────────

describe("parseLinks", () => {
  it("extracts every markdown link as label and url", () => {
    expect(
      parseLinks(
        "[GitHub](https://github.com/jane) | [Demo](http://demo.example/)",
      ),
    ).toEqual([
      { label: "GitHub", url: "https://github.com/jane" },
      { label: "Demo", url: "http://demo.example/" },
    ]);
  });

  it("ignores plain labels without a URL", () => {
    expect(parseLinks("LinkedIn | GitHub")).toEqual([]);
  });

  it("ignores links without an http(s) URL", () => {
    expect(parseLinks("[Thesis](/doc/thesis.pdf)")).toEqual([]);
  });
});

// ─── parseBasics: profiles ────────────────────────────────────────────────────

describe("parseBasics profiles", () => {
  it("extracts header links as profiles", () => {
    expect(parseBasics(LINKED_HEADER_FIXTURE).profiles).toEqual([
      { label: "LinkedIn", url: "https://linkedin.com/in/jane-doe" },
      { label: "GitHub", url: "https://github.com/jane-doe" },
    ]);
  });

  it("returns no profiles for plain labels without URLs", () => {
    expect(parseBasics(HEADER_FIXTURE).profiles).toEqual([]);
  });

  it("keeps links on the contact line out of the contact details", () => {
    const basics = parseBasics(
      "# Jane Doe\n\n**Engineer**\n\njane@example.com | [GitHub](https://github.com/jane) | City",
    );
    expect(basics).toMatchObject({
      email: "jane@example.com",
      location: "City",
      website: "",
      profiles: [{ label: "GitHub", url: "https://github.com/jane" }],
    });
  });

  it("does not pick up links from the sections below the header", () => {
    expect(
      parseBasics(`${HEADER_FIXTURE}\n\n${LINKED_PROJECTS_FIXTURE}`).profiles,
    ).toEqual([]);
  });
});

// ─── parseProjects: links ─────────────────────────────────────────────────────

describe("parseProjects links", () => {
  it("extracts the links of each project", () => {
    const projects = parseProjects(LINKED_PROJECTS_FIXTURE);
    expect(projects[0].links).toEqual([
      { label: "GitHub", url: "https://github.com/jane-doe/widgets" },
      { label: "Demo", url: "https://widgets.example/" },
    ]);
  });

  it("returns no links for plain labels without URLs", () => {
    expect(parseProjects(LINKED_PROJECTS_FIXTURE)[2].links).toEqual([]);
  });

  it("does not mistake a link line for the context paragraph", () => {
    const project = parseProjects(LINKED_PROJECTS_FIXTURE)[1];
    expect(project.context).toBe("");
    expect(project.links).toHaveLength(1);
  });
});
