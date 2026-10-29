import { describe, expect, it } from "vitest";
import type { Env, FetchFn } from "../utils/types.ts";
import {
  connectRxResume,
  CoverLetterTemplate,
  RxResumeErrorCode,
  rxResumeProblem,
} from "./index.ts";
import { CoverLetterLimit } from "./schema.ts";
import {
  type CoverLetter,
  CoverLetterLayout,
  EnvVar,
  type Resume,
  type ResumeData,
  type RxResume,
  type Section,
} from "./types.ts";

// ─── Recording fetch ──────────────────────────────────────────────────────────

const API_URL = "https://rx.example/api/openapi";
const API_KEY = "test-key";
const TODAY = "2026-10-27";

/** The Reactive Resume settings the tests connect with. */
const RX_RESUME_ENV: Env = {
  [EnvVar.ApiKey]: API_KEY,
  [EnvVar.BaseUrl]: API_URL,
  [EnvVar.AppUrl]: "https://rx.example",
};

/** One request as the API received it. */
interface RecordedRequest {
  method: string | undefined;
  url: string;
  apiKey: string | null;
  body: unknown;
}

/**
 * A fetch that answers with `responses` in order and records each request.
 *
 * @param responses - What the API answers, one per request, in order.
 * @returns The fetch to connect with, and the requests it has received.
 * @throws From the fetch, on a request past the last response, naming it.
 */
function recordingFetch(responses: readonly Response[]): {
  fetch: FetchFn;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const pending = [...responses];

  const fetch: FetchFn = async (url, init) => {
    let body: unknown;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    requests.push({
      method: init?.method,
      url,
      apiKey: new Headers(init?.headers).get("x-api-key"),
      body,
    });
    const response = pending.shift();
    if (!response)
      throw new Error(`Unscripted request: ${init?.method} ${url}`);
    return response;
  };

  return { fetch, requests };
}

/** What every id connect hands out starts with: `new-1`, `new-2`, … */
const NEW_ID_PREFIX = "new-";

function connect(fetch: FetchFn, env: Env = RX_RESUME_ENV): RxResume {
  let count = 0;
  return connectRxResume({
    env,
    fetch,
    newId: () => {
      count += 1;
      return `${NEW_ID_PREFIX}${count}`;
    },
    today: () => TODAY,
  });
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

const RESUME_ID = "resume-1";
const RESUME_URL = `${API_URL}/resumes/${RESUME_ID}`;

/** Jane Doe, one job, every section. */
const RESUME_MD = `# Jane Doe

**Software Engineer**

jane.doe@example.com | City, Country | example.com
[LinkedIn](https://linkedin.com/in/jane-doe) |
[GitHub](https://github.com/jane-doe)

---

## Summary

Software engineer with a focus on building reliable products end-to-end, from
API design to the interface people use every day.

---

## Experience

### Example Corp — City

**Senior Software Engineer** | 01/2020 – Present

- Led the migration of a legacy dashboard to a typed component library, cutting
  release time in half.
- Designed the public REST API used by partner integrations.

**Tech Stack:** TypeScript, React, Node.js

---

## Technical Skills

**Languages:** TypeScript, Python, SQL

**Frontend:** React, Vue.js

---

## Education

### Example University — City

**Bachelor's degree, Computer Science** | 2012 – 2016

Graduated with honours.

- (link) Degree course
- Thesis: Distributed Task Scheduling

---

## Projects

### Example Project

A small example project that shows how the resume tools fit together.

**Tech Stack:** TypeScript, Bun

[GitHub](https://github.com/example/example-project) |
[Demo](https://example.com/demo)

---

## Certifications

### Example Certification — Example Issuer

Short description of what it covers.

**Credential ID:** EX-0001

[Credential](https://example.com/cert/EX-0001)

---

## Languages

- English — Native
- Dutch — Conversational

---

## Interests

Cycling · Travel

---

References available upon request
`;

const EMPTY_WEBSITE = { url: "", label: "", inlineLink: false };

function section<TItem>(title: string, items: TItem[]): Section<TItem> {
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

/**
 * A resume's data as `GET /resumes/{id}` returns it: one experience item
 * from an earlier sync, an awards section Resume.md doesn't feed, a picture
 * and a two-column layout.
 *
 * @returns Fresh data on each call, so a test can't change another's.
 *
 * @example
 * storedResume(storedResumeData());
 */
function storedResumeData(): ResumeData {
  return {
    picture: { hidden: true },
    basics: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: { url: "", label: "" },
      customFields: [{ id: "old-cf", icon: "star", text: "Old", link: "" }],
    },
    summary: {
      title: "Summary",
      icon: "",
      columns: 1,
      hidden: false,
      keepTogether: false,
      startOnNewPage: false,
      content: "<p>Old summary.</p>",
    },
    sections: {
      experience: section("Experience", [
        {
          id: "old-job",
          hidden: false,
          company: "Old Corp",
          position: "Engineer",
          location: "",
          period: "",
          description: "",
          website: EMPTY_WEBSITE,
          roles: [],
        },
      ]),
      skills: { ...section("Skills", []), keywordLayout: "inline" },
      education: section("Education", []),
      projects: section("Projects", []),
      certifications: section("Certifications", []),
      languages: section("Languages", []),
      interests: section("Interests", []),
      references: section("References", []),
      awards: section("Awards", [{ id: "award-1", title: "Kept" }]),
    },
    metadata: {
      template: "onyx",
      layout: {
        sidebarWidth: 35,
        pages: [
          {
            fullWidth: false,
            main: ["summary", "experience", "education"],
            sidebar: ["profiles", "skills", "interests"],
          },
        ],
      },
    },
  };
}

/**
 * A resume as the API returns it.
 *
 * @param data - Its `data`.
 * @returns Jane Doe's resume, id RESUME_ID, slug `jane-doe`.
 *
 * @example
 * Response.json(storedResume(storedResumeData()));
 */
function storedResume(data: ResumeData): Resume {
  return {
    id: RESUME_ID,
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
}

// ─── Cover letters ────────────────────────────────────────────────────────────

/** Jane Doe writing to Acme BV. */
const COVER_LETTER_MD = `# Cover letter: Acme BV

## Contact

Manager
Hiring Manager
Acme BV
Amsterdam, Netherlands

---

## Letter

Dear Sender,

I'm writing to apply for the Frontend Engineer role at Acme BV. For the last five years I've built typed component libraries for products used every day.

At Example Corp I led the migration of a legacy dashboard, which cut release time in half. I'd **love** to bring that experience to your team.

---

## Closing

Kind regards,
Jane Doe

---

## Notes

Not part of the letter: send before Friday.
`;

const LETTER_ID = "letter-1";
const LETTER_REVISION = 3;
const LETTER_URL = `${API_URL}/cover-letters/${LETTER_ID}`;

const recipient = "Alex Smith\nAcme BV\nAmsterdam, Netherlands";
const content = "Dear Alex,\n\nI'd like to apply.\n\nKind regards,\nJane Doe";

/** The letter as `GET /cover-letters/{id}` returns it, sender linked. */
const coverLetter: CoverLetter = {
  id: LETTER_ID,
  name: "Acme — Frontend",
  revision: LETTER_REVISION,
  recipient,
  content,
  layout: CoverLetterLayout.Freeform,
  recipientCompany: "",
  letterDate: "2026-10-06",
  senderLinked: true,
  designLinked: true,
  isLocked: false,
  style: {
    basics: {
      name: "Jane Doe",
      headline: "Software Engineer",
      email: "jane.doe@example.com",
      phone: "",
      location: "City, Country",
      website: { url: "https://example.com", label: "" },
      customFields: [],
    },
  },
};

/** What COVER_LETTER_MD sends: Contact, then Letter and Closing. */
const RECIPIENT = "Manager\nHiring Manager\nAcme BV\nAmsterdam, Netherlands";
const CONTENT = [
  "Dear Sender,",
  "",
  "I'm writing to apply for the Frontend Engineer role at Acme BV. For the last five years I've built typed component libraries for products used every day.",
  "",
  "At Example Corp I led the migration of a legacy dashboard, which cut release time in half. I'd **love** to bring that experience to your team.",
  "",
  "Kind regards,",
  "Jane Doe",
].join("\n");

/** A new response each time, since a body can be read only once. */
function conflict(): Response {
  return Response.json(
    { code: "COVER_LETTER_REVISION_CONFLICT", message: "Changed since read" },
    { status: 409 },
  );
}

/** A letter of `## Contact`, `## Letter` and `## Closing`; undefined drops one. */
function letterMd(
  bodies: Partial<Record<"Contact" | "Letter" | "Closing", string>> = {},
): string {
  return Object.entries({
    Contact: "Alex",
    Letter: "Hi",
    Closing: "Jane",
    ...bodies,
  })
    .filter(([, body]) => body !== undefined)
    .map(([heading, body]) => `## ${heading}\n${body}`)
    .join("\n");
}

describe("connectRxResume", () => {
  it("names every missing setting and where they go", () => {
    const missing =
      "Missing RXRESUME_API_KEY, RXRESUME_API_URL, RXRESUME_APP_URL. " +
      "Copy .env.example to .env and fill it in.";

    expect(rxResumeProblem({ RXRESUME_API_KEY: "" })).toBe(missing);
    expect(() => connect(recordingFetch([]).fetch, {})).toThrow(
      expect.objectContaining({
        message: missing,
        reason: expect.objectContaining({
          code: RxResumeErrorCode.MissingSettings,
        }),
      }),
    );
  });

  it("has no problem once every setting is there", () => {
    expect(rxResumeProblem(RX_RESUME_ENV)).toBeUndefined();
  });

  it("links to the builder when the app URL ends in a slash", async () => {
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);
    const env = { ...RX_RESUME_ENV, RXRESUME_APP_URL: "https://rx.example/" };

    const result = await connect(api.fetch, env).resumes.update({
      id: RESUME_ID,
      markdown: RESUME_MD,
    });

    expect(result.builderUrl).toBe(`https://rx.example/builder/${RESUME_ID}`);
  });

  it("passes on an error the API sent without JSON, with its status", async () => {
    const api = recordingFetch([new Response("Bad gateway", { status: 502 })]);

    await expect(
      connect(api.fetch).resumes.delete(RESUME_ID),
    ).rejects.toMatchObject({ status: 502, code: undefined });
  });

  /** Connects with a request log that records lines, on a fake clock. */
  function connectLogging(fetch: FetchFn, env: Env) {
    const lines: string[] = [];
    const times = [1000, 1084];
    const rx = connectRxResume({
      env,
      fetch,
      newId: () => NEW_ID_PREFIX,
      today: () => "2026-10-27",
      requestLog: {
        write: (line) => lines.push(line),
        now: () => times.shift() ?? 0,
      },
    });
    return { rx, lines };
  }

  it("logs each request with its status and time when RXRESUME_DEBUG is set", async () => {
    const api = recordingFetch([new Response(null)]);
    const env = { ...RX_RESUME_ENV, RXRESUME_DEBUG: "1" };
    const { rx, lines } = connectLogging(api.fetch, env);

    await rx.resumes.delete(RESUME_ID);

    expect(lines).toEqual([
      `→ DELETE ${RESUME_URL}`,
      `← 200 DELETE ${RESUME_URL} (84ms)`,
    ]);
  });

  it.each([undefined, ""])(
    "logs nothing when RXRESUME_DEBUG is %j",
    async (debug) => {
      const api = recordingFetch([new Response(null)]);
      const env = { ...RX_RESUME_ENV, RXRESUME_DEBUG: debug };
      const { rx, lines } = connectLogging(api.fetch, env);

      await rx.resumes.delete(RESUME_ID);

      expect(lines).toEqual([]);
    },
  );

  it("names the request and the network code when the API is unreachable", async () => {
    // The shape Bun's fetch rejects with when nothing answers at the URL.
    const refused = Object.assign(
      new Error("Unable to connect. Is the computer able to access the url?"),
      { code: "ConnectionRefused" },
    );
    const fetch: FetchFn = async () => {
      throw refused;
    };

    await expect(
      connect(fetch).resumes.delete(RESUME_ID),
    ).rejects.toMatchObject({
      reason: {
        code: RxResumeErrorCode.Unreachable,
        method: "DELETE",
        url: RESUME_URL,
      },
      cause: refused,
      message:
        `DELETE ${RESUME_URL} failed: ConnectionRefused: Unable to ` +
        "connect. Is the computer able to access the url?\n" +
        "Check RXRESUME_API_URL (http or https, host, port) and that the " +
        "server is running.",
    });
  });
});

describe("resumes.update", () => {
  it("reads the resume, saves it under the same id and links to it", async () => {
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);

    const result = await connect(api.fetch).resumes.update({
      id: RESUME_ID,
      markdown: RESUME_MD,
    });

    expect(api.requests.map(({ method, url }) => [method, url])).toEqual([
      ["GET", RESUME_URL],
      ["PUT", RESUME_URL],
    ]);
    expect(result).toEqual({
      id: RESUME_ID,
      name: "Jane Doe",
      slug: "jane-doe",
      builderUrl: `https://rx.example/builder/${RESUME_ID}`,
    });
  });

  it("writes Resume.md into the data, keeping what it doesn't feed", async () => {
    const stored = storedResumeData();
    const api = recordingFetch([
      Response.json(storedResume(stored)),
      Response.json(storedResume(stored)),
    ]);

    await connect(api.fetch).resumes.update({
      id: RESUME_ID,
      markdown: RESUME_MD,
    });

    const id = expect.any(String);
    const { sections } = stored;
    expect(api.requests[1].body).toEqual({
      data: {
        ...stored,
        basics: {
          name: "Jane Doe",
          headline: "Software Engineer",
          email: "jane.doe@example.com",
          phone: "",
          location: "City, Country",
          website: { url: "https://example.com", label: "example.com" },
          customFields: [
            {
              id,
              icon: "linkedin-logo",
              text: "LinkedIn",
              link: "https://linkedin.com/in/jane-doe",
            },
            {
              id,
              icon: "github-logo",
              text: "GitHub",
              link: "https://github.com/jane-doe",
            },
          ],
        },
        summary: {
          ...stored.summary,
          content:
            "<p>Software engineer with a focus on building reliable products end-to-end, from API design to the interface people use every day.</p>",
        },
        sections: {
          ...sections,
          experience: {
            ...sections.experience,
            items: [
              {
                id,
                hidden: false,
                roles: [],
                company: "Example Corp",
                position: "Senior Software Engineer",
                location: "City",
                period: "01/2020 – Present",
                description:
                  "<p>• Led the migration of a legacy dashboard to a typed component library, cutting release time in half.</p>" +
                  "<p>• Designed the public REST API used by partner integrations.</p>" +
                  "<p><strong>Tech Stack:</strong> TypeScript, React, Node.js</p>",
                website: EMPTY_WEBSITE,
              },
            ],
          },
          skills: {
            ...sections.skills,
            items: [
              {
                id,
                hidden: false,
                icon: "",
                iconColor: "",
                proficiency: "",
                level: 0,
                name: "Languages",
                keywords: ["TypeScript", "Python", "SQL"],
              },
              {
                id,
                hidden: false,
                icon: "",
                iconColor: "",
                proficiency: "",
                level: 0,
                name: "Frontend",
                keywords: ["React", "Vue.js"],
              },
            ],
          },
          education: {
            ...sections.education,
            items: [
              {
                id,
                hidden: false,
                area: "Computer Science",
                grade: "",
                website: EMPTY_WEBSITE,
                school: "Example University",
                degree: "Bachelor's degree",
                location: "City",
                period: "2012 – 2016",
                description:
                  "<p>Graduated with honours.</p>" +
                  "<p>• (link) Degree course</p>" +
                  "<p>• Thesis: Distributed Task Scheduling</p>",
              },
            ],
          },
          projects: {
            ...sections.projects,
            items: [
              {
                id,
                hidden: false,
                period: "",
                name: "Example Project",
                description:
                  "<p>A small example project that shows how the resume tools fit together.</p>" +
                  "<p><strong>Tech Stack:</strong> TypeScript, Bun</p>" +
                  '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/demo">Demo</a></p>',
                website: {
                  url: "https://github.com/example/example-project",
                  label: "GitHub",
                  inlineLink: false,
                },
              },
            ],
          },
          certifications: {
            ...sections.certifications,
            items: [
              {
                id,
                hidden: false,
                date: "",
                website: {
                  url: "https://example.com/cert/EX-0001",
                  label: "Credential",
                  inlineLink: false,
                },
                title: "Example Certification",
                issuer: "Example Issuer",
                description:
                  "<p>Short description of what it covers.</p>" +
                  "<p>Credential ID: EX-0001</p>",
              },
            ],
          },
          languages: {
            ...sections.languages,
            items: [
              {
                id,
                hidden: false,
                level: 0,
                language: "English",
                fluency: "Native",
              },
              {
                id,
                hidden: false,
                level: 0,
                language: "Dutch",
                fluency: "Conversational",
              },
            ],
          },
          interests: {
            ...sections.interests,
            items: ["Cycling", "Travel"].map((name) => ({
              id,
              hidden: false,
              icon: "",
              iconColor: "",
              keywords: [],
              name,
            })),
          },
          references: {
            ...sections.references,
            items: [
              {
                id,
                hidden: false,
                position: "",
                website: EMPTY_WEBSITE,
                phone: "",
                description: "",
                name: "References available upon request",
              },
            ],
          },
        },
      },
    });
  });

  it("adds a job's URL and references, a full website and other links", async () => {
    const markdown = RESUME_MD.replace(
      "example.com\n[LinkedIn]",
      "https://example.com\n[LinkedIn]",
    )
      .replace(
        "[GitHub](https://github.com/jane-doe)",
        "[Blog](https://blog.example)",
      )
      .replace(
        "**Tech Stack:** TypeScript, React, Node.js",
        "**Tech Stack:** TypeScript, React, Node.js\n\n" +
          "https://example-corp.com\n\n" +
          "**Reference:** alex@example.com, sam@example.com",
      );
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);

    await connect(api.fetch).resumes.update({ id: RESUME_ID, markdown });

    const { data } = api.requests[1].body as { data: ResumeData };
    expect(data.basics.website).toEqual({
      url: "https://example.com",
      label: "",
    });
    expect(data.basics.customFields[1]).toMatchObject({
      icon: "link",
      text: "Blog",
    });
    expect(data.sections.experience.items[0]).toMatchObject({
      website: {
        url: "https://example-corp.com",
        label: "",
        inlineLink: false,
      },
    });
    expect(data.sections.experience.items[0].description).toMatch(
      /<p><strong>Reference:<\/strong> alex@example\.com, sam@example\.com<\/p>$/,
    );
  });

  it("writes a school's grade from its **Grade:** line", async () => {
    const markdown = RESUME_MD.replace(
      "**Bachelor's degree, Computer Science** | 2012 – 2016",
      "**Bachelor's degree, Computer Science** | 2012 – 2016\n\n**Grade:** 9.0 / 10",
    );
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);

    await connect(api.fetch).resumes.update({ id: RESUME_ID, markdown });

    const { data } = api.requests[1].body as { data: ResumeData };
    expect(data.sections.education.items[0]).toMatchObject({
      degree: "Bachelor's degree",
      area: "Computer Science",
      grade: "9.0 / 10",
    });
  });

  it("writes a language's level from its (n/5)", async () => {
    const markdown = RESUME_MD.replace(
      "- English — Native",
      "- English — Native (5/5)",
    );
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);

    await connect(api.fetch).resumes.update({ id: RESUME_ID, markdown });

    const { data } = api.requests[1].body as { data: ResumeData };
    expect(data.sections.languages.items[0]).toMatchObject({
      language: "English",
      fluency: "Native",
      level: 5,
    });
  });

  it("gives every item it writes a new id", async () => {
    const stored = storedResume(storedResumeData());
    const api = recordingFetch([Response.json(stored), Response.json(stored)]);

    await connect(api.fetch).resumes.update({
      id: RESUME_ID,
      markdown: RESUME_MD,
    });

    const { basics, sections } = (api.requests[1].body as { data: ResumeData })
      .data;
    const ids = [
      ...basics.customFields,
      ...sections.experience.items,
      ...sections.skills.items,
      ...sections.education.items,
      ...sections.projects.items,
      ...sections.certifications.items,
      ...sections.languages.items,
      ...sections.interests.items,
      ...sections.references.items,
    ].map((item) => item.id);
    // 2 links, 1 job, 2 skill groups, 1 school, 1 project, 1 certification,
    // 2 languages, 2 interests, 1 reference.
    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(NEW_ID_PREFIX)).toBe(true);
  });

  it("checks Resume.md before sending any request", async () => {
    const api = recordingFetch([]);

    await expect(
      connect(api.fetch).resumes.update({
        id: RESUME_ID,
        markdown: RESUME_MD.replace(/## Summary\n[\s\S]*?---/, ""),
      }),
    ).rejects.toThrow(/summary: required/);
    expect(api.requests).toEqual([]);
  });

  it("saves nothing when reading the resume fails", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "NOT_FOUND", message: "Not found" },
        { status: 404 },
      ),
    ]);

    await expect(
      connect(api.fetch).resumes.update({
        id: RESUME_ID,
        markdown: RESUME_MD,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(api.requests).toHaveLength(1);
  });
});

describe("resumes.generate", () => {
  const input = {
    markdown: RESUME_MD,
    name: "Jane Doe",
    slug: "jane-doe",
    tags: ["cv"],
  };

  /** The API creating a resume, then serving its defaults and the update. */
  function apiCreatingResume() {
    const created = storedResume(storedResumeData());
    return recordingFetch([
      Response.json(RESUME_ID),
      Response.json(created),
      Response.json(created),
    ]);
  }

  it("creates the resume, fills in Resume.md and links to it", async () => {
    const api = apiCreatingResume();

    const result = await connect(api.fetch).resumes.generate(input);

    expect(api.requests.map(({ method, url }) => [method, url])).toEqual([
      ["POST", `${API_URL}/resumes`],
      ["GET", RESUME_URL],
      ["PUT", RESUME_URL],
    ]);
    expect(api.requests[0].body).toEqual({
      name: "Jane Doe",
      slug: "jane-doe",
      tags: ["cv"],
    });
    const { data } = api.requests[2].body as { data: ResumeData };
    expect(data.sections.experience.items).toEqual([
      expect.objectContaining({ company: "Example Corp" }),
    ]);
    expect(result).toEqual({
      id: RESUME_ID,
      name: "Jane Doe",
      slug: "jane-doe",
      builderUrl: `https://rx.example/builder/${RESUME_ID}`,
    });
  });

  it("lays the sections out on one full-width page, in reading order", async () => {
    const api = apiCreatingResume();

    await connect(api.fetch).resumes.generate(input);

    const { data } = api.requests[2].body as { data: ResumeData };
    expect(data.metadata.layout).toEqual({
      sidebarWidth: 35,
      pages: [
        {
          fullWidth: true,
          main: [
            "summary",
            "skills",
            "experience",
            "education",
            "projects",
            "languages",
            "certifications",
            "references",
            "interests",
            "profiles",
          ],
          sidebar: [],
        },
      ],
    });
  });

  it("checks Resume.md before creating anything", async () => {
    const api = recordingFetch([]);

    await expect(
      connect(api.fetch).resumes.generate({ ...input, markdown: "# Jane" }),
    ).rejects.toThrow(/summary: required/);
    expect(api.requests).toEqual([]);
  });

  it("stops when creating doesn't answer with an id", async () => {
    const api = recordingFetch([Response.json({ id: RESUME_ID })]);

    await expect(connect(api.fetch).resumes.generate(input)).rejects.toThrow(
      /expected a resume id/,
    );
    expect(api.requests).toHaveLength(1);
  });

  it("writes nothing more when creating the resume fails", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "RESUME_SLUG_ALREADY_EXISTS", message: "Taken" },
        { status: 400 },
      ),
    ]);

    await expect(
      connect(api.fetch).resumes.generate(input),
    ).rejects.toMatchObject({
      status: 400,
      code: "RESUME_SLUG_ALREADY_EXISTS",
    });
    expect(api.requests).toHaveLength(1);
  });
});

describe("resumes.delete", () => {
  it("sends DELETE /resumes/{id} with the API key", async () => {
    const api = recordingFetch([new Response(null)]);

    await connect(api.fetch).resumes.delete(RESUME_ID);

    expect(api.requests).toEqual([
      { method: "DELETE", url: RESUME_URL, apiKey: API_KEY, body: undefined },
    ]);
  });

  it("URL-encodes the id", async () => {
    const api = recordingFetch([new Response(null)]);

    await connect(api.fetch).resumes.delete("a/b");

    expect(api.requests[0].url).toBe(`${API_URL}/resumes/a%2Fb`);
  });

  it("rejects with the API's status and code for a locked resume", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "RESUME_LOCKED", message: "Resume is locked" },
        { status: 403 },
      ),
    ]);

    await expect(
      connect(api.fetch).resumes.delete(RESUME_ID),
    ).rejects.toMatchObject({ status: 403, code: "RESUME_LOCKED" });
  });
});

describe("coverLetters.generate", () => {
  const required = {
    markdown: COVER_LETTER_MD,
    name: "Acme — Frontend",
    resumeId: "resume-1",
  };

  it("posts the letter freeform, dated today, linked to the resume", async () => {
    const api = recordingFetch([
      Response.json({ ...coverLetter, name: required.name, revision: 1 }),
    ]);

    const result = await connect(api.fetch).coverLetters.generate(required);

    expect(api.requests).toEqual([
      expect.objectContaining({
        method: "POST",
        url: `${API_URL}/cover-letters`,
        body: {
          name: "Acme — Frontend",
          resumeId: "resume-1",
          recipient: RECIPIENT,
          content: CONTENT,
          layout: CoverLetterLayout.Freeform,
          letterDate: TODAY,
        },
      }),
    ]);
    expect(result).toEqual({
      id: LETTER_ID,
      name: "Acme — Frontend",
      revision: 1,
      dashboardUrl: `https://rx.example/dashboard/${LETTER_ID}`,
    });
  });

  it("sends company as recipientCompany, with the other optional fields", async () => {
    const api = recordingFetch([Response.json(coverLetter)]);

    await connect(api.fetch).coverLetters.generate({
      ...required,
      applicationId: "application-1",
      company: "Acme BV",
      template: CoverLetterTemplate.Onyx,
    });

    expect(api.requests[0].body).toMatchObject({
      applicationId: "application-1",
      recipientCompany: "Acme BV",
      template: CoverLetterTemplate.Onyx,
    });
  });

  it.each([
    ["Contact", "contact"],
    ["Letter", "letter"],
    ["Closing", "closing"],
  ] as const)(
    "names ## %s when it's missing or empty, before any request",
    async (heading, path) => {
      const api = recordingFetch([]);
      const rx = connect(api.fetch);

      for (const markdown of [
        letterMd({ [heading]: undefined }),
        letterMd({ [heading]: "---" }),
      ]) {
        await expect(
          rx.coverLetters.generate({ ...required, markdown }),
        ).rejects.toThrow(`${path}: required`);
      }
      expect(api.requests).toEqual([]);
    },
  );

  it("rejects text and a name over the API's limits, before any request", async () => {
    const api = recordingFetch([]);
    const rx = connect(api.fetch);
    const closing = "Jane";

    await expect(
      rx.coverLetters.generate({
        ...required,
        markdown: letterMd({
          Contact: "x".repeat(CoverLetterLimit.RecipientMax + 1),
        }),
      }),
    ).rejects.toThrow("recipient: Too big");
    await expect(
      rx.coverLetters.generate({
        ...required,
        // The letter alone fits; with the blank line and closing it doesn't.
        markdown: letterMd({
          Letter: "x".repeat(CoverLetterLimit.ContentMax - closing.length),
          Closing: closing,
        }),
      }),
    ).rejects.toThrow("content: Too big");
    await expect(
      rx.coverLetters.generate({
        ...required,
        name: "x".repeat(CoverLetterLimit.NameMax + 1),
      }),
    ).rejects.toThrow(/name:/);
    expect(api.requests).toEqual([]);
  });
});

describe("coverLetters.update", () => {
  it("reads the letter, then puts the text at its revision, dated today", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      Response.json({ ...coverLetter, revision: LETTER_REVISION + 1 }),
    ]);

    const result = await connect(api.fetch).coverLetters.update({
      id: LETTER_ID,
      markdown: COVER_LETTER_MD,
    });

    expect(api.requests.map(({ method, url }) => [method, url])).toEqual([
      ["GET", LETTER_URL],
      ["PUT", LETTER_URL],
    ]);
    // No layout, which PUT can't change, and no field that wasn't given.
    expect(api.requests[1].body).toEqual({
      expectedRevision: LETTER_REVISION,
      recipient: RECIPIENT,
      content: CONTENT,
      letterDate: TODAY,
    });
    expect(result.revision).toBe(LETTER_REVISION + 1);
  });

  it("sends the fields given, company as recipientCompany", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      Response.json(coverLetter),
    ]);

    await connect(api.fetch).coverLetters.update({
      id: LETTER_ID,
      markdown: COVER_LETTER_MD,
      name: "Renamed",
      company: "Acme BV",
      resumeId: "resume-2",
    });

    expect(api.requests[1].body).toMatchObject({
      name: "Renamed",
      recipientCompany: "Acme BV",
      resumeId: "resume-2",
    });
  });

  it("refuses a letter that isn't freeform, before sending an update", async () => {
    const api = recordingFetch([
      Response.json({ ...coverLetter, layout: CoverLetterLayout.Structured }),
    ]);

    await expect(
      connect(api.fetch).coverLetters.update({
        id: LETTER_ID,
        markdown: COVER_LETTER_MD,
      }),
    ).rejects.toMatchObject({
      reason: {
        code: RxResumeErrorCode.NotFreeform,
        id: LETTER_ID,
        layout: CoverLetterLayout.Structured,
      },
    });
    expect(api.requests).toHaveLength(1);
  });

  it("passes on the API's error when the letter changed since it was read", async () => {
    const api = recordingFetch([Response.json(coverLetter), conflict()]);

    await expect(
      connect(api.fetch).coverLetters.update({
        id: LETTER_ID,
        markdown: COVER_LETTER_MD,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "COVER_LETTER_REVISION_CONFLICT",
    });
    expect(api.requests).toHaveLength(2);
  });
});

describe("coverLetters.delete", () => {
  it("reads the letter, moves it to Trash at its revision, then purges it", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      new Response(null),
      new Response(null),
    ]);

    await connect(api.fetch).coverLetters.delete(LETTER_ID);

    expect(
      api.requests.map(({ method, url, body }) => [method, url, body]),
    ).toEqual([
      ["GET", LETTER_URL, undefined],
      ["DELETE", LETTER_URL, { expectedRevision: LETTER_REVISION }],
      ["DELETE", `${API_URL}/documents/letter/${LETTER_ID}`, undefined],
    ]);
  });

  it("says the letter is in Trash when the purge fails", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      new Response(null),
      conflict(),
    ]);

    await expect(
      connect(api.fetch).coverLetters.delete(LETTER_ID),
    ).rejects.toMatchObject({
      reason: { code: RxResumeErrorCode.LeftInTrash, id: LETTER_ID },
      message: expect.stringMatching(`letter ${LETTER_ID} is in Trash$`),
    });
  });

  it("never purges when moving to Trash fails", async () => {
    const api = recordingFetch([Response.json(coverLetter), conflict()]);

    await expect(
      connect(api.fetch).coverLetters.delete(LETTER_ID),
    ).rejects.toMatchObject({ status: 409 });
    expect(api.requests).toHaveLength(2);
  });
});
