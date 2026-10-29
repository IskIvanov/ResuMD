import { describe, expect, it } from "vitest";
import { relative } from "path";
import type { ToolDependencies, ToolDefinition } from "../cli/types.ts";
import type { EnvironmentVariables, FetchFunction } from "../utils/types.ts";
import { CoverLetterLimit } from "./api/schema.ts";
import {
  type CoverLetter,
  CoverLetterLayout,
  CoverLetterTemplate,
  EnvironmentVariable,
  type Resume,
  type ResumeData,
  type Section,
} from "./api/types.ts";
import {
  deleteCoverLetterTool,
  deleteResumeTool,
  createCoverLetterTool,
  createResumeTool,
  updateCoverLetterTool,
  updateResumeTool,
} from "./index.ts";

// ─── Recording fetch ──────────────────────────────────────────────────────────

const API_URL = "https://rx.example/api/openapi";
const API_KEY = "test-key";
const TODAY = "2026-10-27";

/** The Reactive Resume settings the tests connect with. */
const RX_RESUME_SETTINGS: EnvironmentVariables = {
  [EnvironmentVariable.ApiKey]: API_KEY,
  [EnvironmentVariable.ApiUrl]: API_URL,
  [EnvironmentVariable.AppUrl]: "https://rx.example",
};

/** One request as the API received it, with the JSON the tool sent. */
interface ReceivedRequest {
  method: string | undefined;
  url: string;
  apiKey: string | null;
  sentJson: unknown;
}

/**
 * A fetch that answers with `scriptedResponses` in order and records each
 * request it receives.
 *
 * @param scriptedResponses - What the API answers, one per request, in order.
 * @returns The fetch to connect with, and the requests it has received.
 * @throws From the fetch, on a request past the last response, naming it.
 */
function recordingFetch(scriptedResponses: readonly Response[]): {
  fetch: FetchFunction;
  receivedRequests: ReceivedRequest[];
} {
  const receivedRequests: ReceivedRequest[] = [];
  const unsentResponses = [...scriptedResponses];

  const fetch: FetchFunction = async (url, httpRequest) => {
    let sentJson: unknown;
    if (typeof httpRequest?.body === "string") {
      sentJson = JSON.parse(httpRequest.body);
    }
    receivedRequests.push({
      method: httpRequest?.method,
      url,
      apiKey: new Headers(httpRequest?.headers).get("x-api-key"),
      sentJson,
    });
    const scriptedResponse = unsentResponses.shift();
    if (!scriptedResponse)
      throw new Error(`Unscripted request: ${httpRequest?.method} ${url}`);
    return scriptedResponse;
  };

  return { fetch, receivedRequests };
}

// ─── Running a tool ───────────────────────────────────────────────────────────

const WORKING_DIRECTORY = "/work";
const RESUME_FILE = "Resume.md";
const LETTER_FILE = "letter.md";

/** What every id a tool hands out starts with: `new-1`, `new-2`, … */
const NEW_ID_PREFIX = "new-";

/** What a tool printed while it ran. */
interface ToolOutput {
  output: string[];
  errors: string[];
}

/**
 * Runs a tool from WORKING_DIRECTORY with its tool arguments, as
 * `bun run cli <id> …` would, against a
 * recording fetch and an in-memory file system.
 *
 * @param tool - A registered tool.
 * @param toolArguments - Its flags.
 * @param doubles - The fetch to send requests with, the environment variables
 *   (the Reactive Resume settings by default) and files by path relative to
 *   WORKING_DIRECTORY, over Resume.md
 *   and letter.md.
 * @returns The lines it printed to stdout and stderr.
 * @throws Whatever the tool throws.
 */
async function runTool(
  tool: ToolDefinition,
  toolArguments: readonly string[],
  doubles: {
    fetch: FetchFunction;
    environmentVariables?: EnvironmentVariables;
    files?: Record<string, string>;
  },
): Promise<ToolOutput> {
  const files: Record<string, string> = {
    [RESUME_FILE]: RESUME_MD,
    [LETTER_FILE]: COVER_LETTER_MD,
    ...doubles.files,
  };
  const printed: ToolOutput = { output: [], errors: [] };
  const clockReadings = [1000, 1084, 2000, 2042];
  let idsIssued = 0;
  const dependencies: ToolDependencies = {
    workingDirectory: WORKING_DIRECTORY,
    environmentVariables: doubles.environmentVariables ?? RX_RESUME_SETTINGS,
    fetch: doubles.fetch,
    newId: () => {
      idsIssued += 1;
      return `${NEW_ID_PREFIX}${idsIssued}`;
    },
    today: () => TODAY,
    now: () => clockReadings.shift() ?? 0,
    readFile: (path) => {
      const text = files[relative(WORKING_DIRECTORY, path)];
      if (text === undefined) throw new Error(`No such file: ${path}`);
      return text;
    },
    log: (line) => printed.output.push(line),
    logError: (line) => printed.errors.push(line),
  };
  await tool.run(toolArguments, dependencies);
  return printed;
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

const RESUME_ID = "resume-1";
const RESUME_URL = `${API_URL}/resumes/${RESUME_ID}`;
const UPDATE_ARGUMENTS = ["--id", RESUME_ID, "--resume", RESUME_FILE];

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

/** The API serving a stored resume, then the same resume once it's saved. */
function apiServingResume() {
  const stored = storedResume(storedResumeData());
  return recordingFetch([Response.json(stored), Response.json(stored)]);
}

/** The `data` the second request (the PUT) sent. */
function savedData(receivedRequests: ReceivedRequest[]): ResumeData {
  return (receivedRequests[1].sentJson as { data: ResumeData }).data;
}

// ─── Cover letters ────────────────────────────────────────────────────────────

/** Jane Doe writing to Acme BV. */
const COVER_LETTER_MD = `# Cover letter: Acme BV

## Recipient

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

## Sign-off

Kind regards,
Jane Doe

---

## Notes

Not part of the letter: send before Friday.
`;

/** Reactive Resume gives cover letters UUIDs. */
const LETTER_ID = "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c";
const LETTER_REVISION = 3;
const LETTER_URL = `${API_URL}/cover-letters/${LETTER_ID}`;
const LETTER_NAME = "Acme — Frontend";

/** create-cover-letter'"'"'s required flags. */
const CREATE_LETTER_ARGUMENTS = [
  "--letter",
  LETTER_FILE,
  "--name",
  LETTER_NAME,
  "--resume-id",
  RESUME_ID,
];
const UPDATE_LETTER_ARGUMENTS = ["--id", LETTER_ID, "--letter", LETTER_FILE];

/** The letter as `GET /cover-letters/{id}` returns it, sender linked. */
const coverLetter: CoverLetter = {
  id: LETTER_ID,
  name: LETTER_NAME,
  revision: LETTER_REVISION,
  recipient: "Alex Smith\nAcme BV\nAmsterdam, Netherlands",
  content: "Dear Alex,\n\nI'd like to apply.\n\nKind regards,\nJane Doe",
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

/** What COVER_LETTER_MD sends: the recipient block, then the body and sign-off. */
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

/** A letter of `## Recipient`, `## Letter` and `## Sign-off`; undefined drops one. */
function letterMd(
  sectionTexts: Partial<
    Record<"Recipient" | "Letter" | "Sign-off", string>
  > = {},
): string {
  return Object.entries({
    Recipient: "Alex",
    Letter: "Hi",
    "Sign-off": "Jane",
    ...sectionTexts,
  })
    .filter(([, sectionText]) => sectionText !== undefined)
    .map(([heading, sectionText]) => `## ${heading}\n${sectionText}`)
    .join("\n");
}

describe("every tool", () => {
  it("names every missing setting and where they go", async () => {
    const missing =
      "Missing RXRESUME_API_KEY, RXRESUME_API_URL, RXRESUME_APP_URL. " +
      "Copy .env.example to .env and fill it in.";

    expect(deleteResumeTool.preflight?.({ RXRESUME_API_KEY: "" })).toBe(
      missing,
    );
    await expect(
      runTool(deleteResumeTool, ["--id", RESUME_ID], {
        fetch: recordingFetch([]).fetch,
        environmentVariables: {},
      }),
    ).rejects.toThrow(missing);
  });

  it("has no problem once every setting is there", () => {
    expect(deleteResumeTool.preflight?.(RX_RESUME_SETTINGS)).toBeUndefined();
  });

  it("links to the editor when the app URL ends in a slash", async () => {
    const api = apiServingResume();
    const environmentVariables = {
      ...RX_RESUME_SETTINGS,
      RXRESUME_APP_URL: "https://rx.example/",
    };

    const { output } = await runTool(updateResumeTool, UPDATE_ARGUMENTS, {
      fetch: api.fetch,
      environmentVariables,
    });

    expect(output).toContain(
      `  editor: https://rx.example/builder/${RESUME_ID}`,
    );
  });

  it("passes on an error the API sent without JSON, with its status", async () => {
    const api = recordingFetch([new Response("Bad gateway", { status: 502 })]);

    await expect(
      runTool(deleteResumeTool, ["--id", RESUME_ID], { fetch: api.fetch }),
    ).rejects.toMatchObject({ status: 502, code: undefined });
  });

  it("logs each request with its status and time when RXRESUME_DEBUG is set", async () => {
    const api = recordingFetch([new Response(null), new Response(null)]);
    const environmentVariables = { ...RX_RESUME_SETTINGS, RXRESUME_DEBUG: "1" };
    const purgeUrl = `${API_URL}/documents/resume/${RESUME_ID}`;

    const { errors } = await runTool(deleteResumeTool, ["--id", RESUME_ID], {
      fetch: api.fetch,
      environmentVariables,
    });

    expect(errors).toEqual([
      `→ DELETE ${RESUME_URL}`,
      `← 200 DELETE ${RESUME_URL} (84ms)`,
      `→ DELETE ${purgeUrl}`,
      `← 200 DELETE ${purgeUrl} (42ms)`,
    ]);
  });

  it.each([undefined, ""])(
    "logs nothing when RXRESUME_DEBUG is %j",
    async (debug) => {
      const api = recordingFetch([new Response(null), new Response(null)]);
      const environmentVariables = {
        ...RX_RESUME_SETTINGS,
        RXRESUME_DEBUG: debug,
      };

      const { errors } = await runTool(deleteResumeTool, ["--id", RESUME_ID], {
        fetch: api.fetch,
        environmentVariables,
      });

      expect(errors).toEqual([]);
    },
  );

  it("names the request and the network code when the API is unreachable", async () => {
    // The shape Bun's fetch rejects with when nothing answers at the URL.
    const refused = Object.assign(
      new Error("Unable to connect. Is the computer able to access the url?"),
      { code: "ConnectionRefused" },
    );
    const fetch: FetchFunction = async () => {
      throw refused;
    };

    await expect(
      runTool(deleteResumeTool, ["--id", RESUME_ID], { fetch }),
    ).rejects.toMatchObject({
      cause: refused,
      message:
        `DELETE ${RESUME_URL} failed: ConnectionRefused: Unable to ` +
        "connect. Is the computer able to access the url?\n" +
        "Check RXRESUME_API_URL (http or https, host, port) and that the " +
        "server is running.",
    });
  });
});

describe("update-resume", () => {
  it("reads the resume, saves it under the same id and links to it", async () => {
    const api = apiServingResume();

    const { output } = await runTool(updateResumeTool, UPDATE_ARGUMENTS, {
      fetch: api.fetch,
    });

    expect(
      api.receivedRequests.map(({ method, url }) => [method, url]),
    ).toEqual([
      ["GET", RESUME_URL],
      ["PUT", RESUME_URL],
    ]);
    expect(output).toEqual([
      `✓ Updated "Jane Doe" (slug jane-doe, id ${RESUME_ID})`,
      `  editor: https://rx.example/builder/${RESUME_ID}`,
    ]);
  });

  it("writes Resume.md into the data, keeping what it doesn't feed", async () => {
    const stored = storedResumeData();
    const api = recordingFetch([
      Response.json(storedResume(stored)),
      Response.json(storedResume(stored)),
    ]);

    await runTool(updateResumeTool, UPDATE_ARGUMENTS, { fetch: api.fetch });

    const id = expect.any(String);
    const { sections } = stored;
    expect(api.receivedRequests[1].sentJson).toEqual({
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
    const api = apiServingResume();

    await runTool(updateResumeTool, UPDATE_ARGUMENTS, {
      fetch: api.fetch,
      files: { [RESUME_FILE]: markdown },
    });

    const data = savedData(api.receivedRequests);
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
    const api = apiServingResume();

    await runTool(updateResumeTool, UPDATE_ARGUMENTS, {
      fetch: api.fetch,
      files: { [RESUME_FILE]: markdown },
    });

    expect(
      savedData(api.receivedRequests).sections.education.items[0],
    ).toMatchObject({
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
    const api = apiServingResume();

    await runTool(updateResumeTool, UPDATE_ARGUMENTS, {
      fetch: api.fetch,
      files: { [RESUME_FILE]: markdown },
    });

    expect(
      savedData(api.receivedRequests).sections.languages.items[0],
    ).toMatchObject({
      language: "English",
      fluency: "Native",
      level: 5,
    });
  });

  it("gives every item it writes a new id", async () => {
    const api = apiServingResume();

    await runTool(updateResumeTool, UPDATE_ARGUMENTS, { fetch: api.fetch });

    const { basics, sections } = savedData(api.receivedRequests);
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
      runTool(updateResumeTool, UPDATE_ARGUMENTS, {
        fetch: api.fetch,
        files: {
          [RESUME_FILE]: RESUME_MD.replace(/## Summary\n[\s\S]*?---/, ""),
        },
      }),
    ).rejects.toThrow(/summary: required/);
    expect(api.receivedRequests).toEqual([]);
  });

  it("saves nothing when reading the resume fails", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "NOT_FOUND", message: "Not found" },
        { status: 404 },
      ),
    ]);

    await expect(
      runTool(updateResumeTool, UPDATE_ARGUMENTS, { fetch: api.fetch }),
    ).rejects.toMatchObject({ status: 404 });
    expect(api.receivedRequests).toHaveLength(1);
  });
});

describe("create-resume", () => {
  const toolArguments = [
    "--resume",
    RESUME_FILE,
    "--name",
    "Jane Doe",
    "--tags",
    "cv",
  ];

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

    const { output } = await runTool(createResumeTool, toolArguments, {
      fetch: api.fetch,
    });

    expect(
      api.receivedRequests.map(({ method, url }) => [method, url]),
    ).toEqual([
      ["POST", `${API_URL}/resumes`],
      ["GET", RESUME_URL],
      ["PUT", RESUME_URL],
    ]);
    expect(api.receivedRequests[0].sentJson).toEqual({
      name: "Jane Doe",
      slug: "jane-doe",
      tags: ["cv"],
    });
    const { data } = api.receivedRequests[2].sentJson as { data: ResumeData };
    expect(data.sections.experience.items).toEqual([
      expect.objectContaining({ company: "Example Corp" }),
    ]);
    expect(output).toEqual([
      `✓ Created "Jane Doe" (slug jane-doe, id ${RESUME_ID})`,
      `  editor: https://rx.example/builder/${RESUME_ID}`,
    ]);
  });

  it("lays the sections out on one full-width page, in reading order", async () => {
    const api = apiCreatingResume();

    await runTool(createResumeTool, toolArguments, { fetch: api.fetch });

    const { data } = api.receivedRequests[2].sentJson as { data: ResumeData };
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
      runTool(createResumeTool, toolArguments, {
        fetch: api.fetch,
        files: { [RESUME_FILE]: "# Jane" },
      }),
    ).rejects.toThrow(/summary: required/);
    expect(api.receivedRequests).toEqual([]);
  });

  it("stops when creating doesn't answer with an id", async () => {
    const api = recordingFetch([Response.json({ id: RESUME_ID })]);

    await expect(
      runTool(createResumeTool, toolArguments, { fetch: api.fetch }),
    ).rejects.toThrow(/expected a resume id/);
    expect(api.receivedRequests).toHaveLength(1);
  });

  it("writes nothing more when creating the resume fails", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "RESUME_SLUG_ALREADY_EXISTS", message: "Taken" },
        { status: 400 },
      ),
    ]);

    await expect(
      runTool(createResumeTool, toolArguments, { fetch: api.fetch }),
    ).rejects.toMatchObject({
      status: 400,
      code: "RESUME_SLUG_ALREADY_EXISTS",
    });
    expect(api.receivedRequests).toHaveLength(1);
  });
});

describe("delete-resume", () => {
  it("moves the resume to Trash, then purges it, with the API key", async () => {
    const api = recordingFetch([new Response(null), new Response(null)]);

    const { output } = await runTool(deleteResumeTool, ["--id", RESUME_ID], {
      fetch: api.fetch,
    });

    expect(api.receivedRequests).toEqual([
      {
        method: "DELETE",
        url: RESUME_URL,
        apiKey: API_KEY,
        sentJson: undefined,
      },
      {
        method: "DELETE",
        url: `${API_URL}/documents/resume/${RESUME_ID}`,
        apiKey: API_KEY,
        sentJson: undefined,
      },
    ]);
    expect(output).toEqual([`✓ Deleted resume ${RESUME_ID}`]);
  });

  it("URL-encodes the id", async () => {
    const api = recordingFetch([new Response(null), new Response(null)]);

    await runTool(deleteResumeTool, ["--id", "a/b"], { fetch: api.fetch });

    expect(api.receivedRequests.map(({ url }) => url)).toEqual([
      `${API_URL}/resumes/a%2Fb`,
      `${API_URL}/documents/resume/a%2Fb`,
    ]);
  });

  it("says the resume is in Trash when the purge fails", async () => {
    const api = recordingFetch([new Response(null), conflict()]);

    await expect(
      runTool(deleteResumeTool, ["--id", RESUME_ID], { fetch: api.fetch }),
    ).rejects.toThrow(
      new RegExp(`Changed since read; resume ${RESUME_ID} is in Trash$`),
    );
  });

  it("rejects with the API's status and code for a locked resume", async () => {
    const api = recordingFetch([
      Response.json(
        { code: "RESUME_LOCKED", message: "Resume is locked" },
        { status: 403 },
      ),
    ]);

    await expect(
      runTool(deleteResumeTool, ["--id", RESUME_ID], { fetch: api.fetch }),
    ).rejects.toMatchObject({ status: 403, code: "RESUME_LOCKED" });
  });
});

describe("create-cover-letter", () => {
  it("posts the letter freeform, dated today, linked to the resume", async () => {
    const api = recordingFetch([
      Response.json({ ...coverLetter, revision: 1 }),
    ]);

    const { output } = await runTool(
      createCoverLetterTool,
      CREATE_LETTER_ARGUMENTS,
      { fetch: api.fetch },
    );

    expect(api.receivedRequests).toEqual([
      expect.objectContaining({
        method: "POST",
        url: `${API_URL}/cover-letters`,
        sentJson: {
          name: LETTER_NAME,
          resumeId: RESUME_ID,
          recipient: RECIPIENT,
          content: CONTENT,
          layout: CoverLetterLayout.Freeform,
          letterDate: TODAY,
        },
      }),
    ]);
    expect(output).toEqual([
      `✓ Created cover letter "${LETTER_NAME}" (id ${LETTER_ID}, revision 1)`,
      `  editor: https://rx.example/dashboard/${LETTER_ID}`,
    ]);
  });

  it("sends company as recipientCompany, with the other optional fields", async () => {
    const api = recordingFetch([Response.json(coverLetter)]);

    const { output } = await runTool(
      createCoverLetterTool,
      [
        ...CREATE_LETTER_ARGUMENTS,
        "--application-id",
        "application-1",
        "--company",
        "Acme BV",
        "--template",
        CoverLetterTemplate.Onyx,
      ],
      { fetch: api.fetch },
    );

    expect(api.receivedRequests[0].sentJson).toMatchObject({
      applicationId: "application-1",
      recipientCompany: "Acme BV",
      template: CoverLetterTemplate.Onyx,
    });
    expect(output[0]).toContain(`template ${CoverLetterTemplate.Onyx}`);
  });

  it.each([
    ["Recipient", "recipient"],
    ["Letter", "letter"],
    ["Sign-off", "signOff"],
  ] as const)(
    "names ## %s when it's missing or empty, before any request",
    async (heading, path) => {
      const api = recordingFetch([]);

      for (const markdown of [
        letterMd({ [heading]: undefined }),
        letterMd({ [heading]: "---" }),
      ]) {
        await expect(
          runTool(createCoverLetterTool, CREATE_LETTER_ARGUMENTS, {
            fetch: api.fetch,
            files: { [LETTER_FILE]: markdown },
          }),
        ).rejects.toThrow(`${path}: required`);
      }
      expect(api.receivedRequests).toEqual([]);
    },
  );

  it("rejects text and a name over the API's limits, before any request", async () => {
    const api = recordingFetch([]);
    const signOff = "Jane";
    const create = (
      files: Record<string, string>,
      toolArguments = CREATE_LETTER_ARGUMENTS,
    ) =>
      runTool(createCoverLetterTool, toolArguments, {
        fetch: api.fetch,
        files,
      });

    await expect(
      create({
        [LETTER_FILE]: letterMd({
          Recipient: "x".repeat(CoverLetterLimit.RecipientMax + 1),
        }),
      }),
    ).rejects.toThrow("recipient: Too big");
    await expect(
      create({
        // The letter alone fits; with the blank line and sign-off it doesn't.
        [LETTER_FILE]: letterMd({
          Letter: "x".repeat(CoverLetterLimit.ContentMax - signOff.length),
          "Sign-off": signOff,
        }),
      }),
    ).rejects.toThrow("content: Too big");
    await expect(
      create({}, [
        ...CREATE_LETTER_ARGUMENTS,
        "--name",
        "x".repeat(CoverLetterLimit.NameMax + 1),
      ]),
    ).rejects.toThrow(/name:/);
    expect(api.receivedRequests).toEqual([]);
  });
});

describe("update-cover-letter", () => {
  it("reads the letter, then puts the text at its revision, dated today", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      Response.json({ ...coverLetter, revision: LETTER_REVISION + 1 }),
    ]);

    const { output } = await runTool(
      updateCoverLetterTool,
      UPDATE_LETTER_ARGUMENTS,
      {
        fetch: api.fetch,
      },
    );

    expect(
      api.receivedRequests.map(({ method, url }) => [method, url]),
    ).toEqual([
      ["GET", LETTER_URL],
      ["PUT", LETTER_URL],
    ]);
    // No layout, which PUT can't change, and no field that wasn't given.
    expect(api.receivedRequests[1].sentJson).toEqual({
      expectedRevision: LETTER_REVISION,
      recipient: RECIPIENT,
      content: CONTENT,
      letterDate: TODAY,
    });
    expect(output).toEqual([
      `✓ Updated cover letter "${LETTER_NAME}" (id ${LETTER_ID}, revision ${LETTER_REVISION + 1})`,
      `  editor: https://rx.example/dashboard/${LETTER_ID}`,
    ]);
  });

  it("sends the fields given, company as recipientCompany", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      Response.json(coverLetter),
    ]);

    await runTool(
      updateCoverLetterTool,
      [
        ...UPDATE_LETTER_ARGUMENTS,
        "--name",
        "Renamed",
        "--company",
        "Acme BV",
        "--resume-id",
        "resume-2",
      ],
      { fetch: api.fetch },
    );

    expect(api.receivedRequests[1].sentJson).toMatchObject({
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
      runTool(updateCoverLetterTool, UPDATE_LETTER_ARGUMENTS, {
        fetch: api.fetch,
      }),
    ).rejects.toThrow(
      `Cover letter ${LETTER_ID} is laid out "structured"; only a freeform ` +
        "letter can be updated, since the .md writes its own greeting and " +
        "sign-off",
    );
    expect(api.receivedRequests).toHaveLength(1);
  });

  it("passes on the API's error when the letter changed since it was read", async () => {
    const api = recordingFetch([Response.json(coverLetter), conflict()]);

    await expect(
      runTool(updateCoverLetterTool, UPDATE_LETTER_ARGUMENTS, {
        fetch: api.fetch,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "COVER_LETTER_REVISION_CONFLICT",
    });
    expect(api.receivedRequests).toHaveLength(2);
  });
});

describe("delete-cover-letter", () => {
  const toolArguments = ["--id", LETTER_ID];

  it("reads the letter, moves it to Trash at its revision, then purges it", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      new Response(null),
      new Response(null),
    ]);

    const { output } = await runTool(deleteCoverLetterTool, toolArguments, {
      fetch: api.fetch,
    });

    expect(
      api.receivedRequests.map(({ method, url, sentJson }) => [
        method,
        url,
        sentJson,
      ]),
    ).toEqual([
      ["GET", LETTER_URL, undefined],
      ["DELETE", LETTER_URL, { expectedRevision: LETTER_REVISION }],
      ["DELETE", `${API_URL}/documents/letter/${LETTER_ID}`, undefined],
    ]);
    expect(output).toEqual([`✓ Deleted cover letter ${LETTER_ID}`]);
  });

  it("says the letter is in Trash when the purge fails", async () => {
    const api = recordingFetch([
      Response.json(coverLetter),
      new Response(null),
      conflict(),
    ]);

    await expect(
      runTool(deleteCoverLetterTool, toolArguments, { fetch: api.fetch }),
    ).rejects.toThrow(
      new RegExp(`Changed since read; letter ${LETTER_ID} is in Trash$`),
    );
  });

  it("never purges when moving to Trash fails", async () => {
    const api = recordingFetch([Response.json(coverLetter), conflict()]);

    await expect(
      runTool(deleteCoverLetterTool, toolArguments, { fetch: api.fetch }),
    ).rejects.toMatchObject({ status: 409 });
    expect(api.receivedRequests).toHaveLength(2);
  });
});
