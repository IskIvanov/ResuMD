import { describe, it, expect, vi } from "vitest";
import { generateResume } from "./generate.ts";
import { SECTION_ORDER } from "../rx-resume/layout.ts";
import type {
  ParsedResumeData,
  Resume,
  ResumeData,
  RxResumeClient,
} from "../rx-resume/types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResume(data: ResumeData): Resume {
  return {
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
}

function makeSection() {
  return {
    title: "",
    icon: "",
    columns: 1,
    hidden: false,
    keepTogether: false,
    startOnNewPage: false,
    items: [],
  };
}

const createdData: ResumeData = {
  basics: {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: { url: "", label: "" },
    customFields: [],
  },
  summary: { ...makeSection(), content: "" },
  sections: {
    experience: makeSection(),
    skills: makeSection(),
    education: makeSection(),
    projects: makeSection(),
    certifications: makeSection(),
    languages: makeSection(),
    interests: makeSection(),
    references: makeSection(),
  },
  metadata: {
    layout: {
      sidebarWidth: 35,
      pages: [
        {
          fullWidth: false,
          main: ["summary", "experience", "education"],
          sidebar: ["profiles", "skills"],
        },
      ],
    },
  },
};

const parsed: ParsedResumeData = {
  basics: {
    name: "Jane Doe",
    headline: "Software Engineer",
    email: "jane.doe@example.com",
    phone: "",
    location: "City",
    website: { url: "", label: "" },
    customFields: [],
  },
  summary: { content: "<p>Senior engineer.</p>" },
  sections: {
    experience: { items: [] },
    skills: { items: [{ name: "Languages", keywords: ["TypeScript"] }] },
    education: { items: [] },
    projects: { items: [] },
    certifications: { items: [] },
    languages: { items: [] },
    interests: { items: [{ name: "Cycling" }] },
    references: { items: [] },
  },
};

const input = {
  name: "Jane Doe",
  slug: "jane-doe",
  tags: ["cv"],
  data: parsed,
};

function makeClient(): RxResumeClient {
  return {
    createResume: vi.fn().mockResolvedValue("resume-1"),
    getResume: vi.fn().mockResolvedValue(makeResume(createdData)),
    updateResume: vi
      .fn()
      .mockImplementation(async (_id: string, body: { data: ResumeData }) =>
        makeResume(body.data),
      ),
  };
}

// ─── generateResume ───────────────────────────────────────────────────────────

describe("generateResume", () => {
  it("creates the resume with its name, slug and tags", async () => {
    const client = makeClient();
    await generateResume(client, input, () => "id");
    expect(client.createResume).toHaveBeenCalledWith({
      name: "Jane Doe",
      slug: "jane-doe",
      tags: ["cv"],
    });
  });

  it("fetches the created resume by the returned id", async () => {
    const client = makeClient();
    await generateResume(client, input, () => "id");
    expect(client.getResume).toHaveBeenCalledWith("resume-1");
  });

  it("updates the resume with the parsed data applied to the created data", async () => {
    const client = makeClient();
    await generateResume(client, input, () => "item-id");

    const [id, body] = vi.mocked(client.updateResume).mock.calls[0];
    expect(id).toBe("resume-1");
    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data?.summary.content).toBe("<p>Senior engineer.</p>");
    expect(body.data?.basics.name).toBe("Jane Doe");
    expect(body.data?.sections.interests.items).toMatchObject([
      { id: "item-id", name: "Cycling" },
    ]);
    expect(body.data?.sections.skills.items).toMatchObject([
      { id: "item-id", name: "Languages", keywords: ["TypeScript"] },
    ]);
  });

  it("orders the sections on a single full-width page", async () => {
    const client = makeClient();
    await generateResume(client, input, () => "id");

    const [, body] = vi.mocked(client.updateResume).mock.calls[0];
    expect(body.data?.metadata.layout.pages).toEqual([
      {
        fullWidth: true,
        main: [...SECTION_ORDER, "profiles"],
        sidebar: [],
      },
    ]);
  });

  it("returns the updated resume", async () => {
    const resume = await generateResume(makeClient(), input, () => "id");
    expect(resume.data.summary.content).toBe("<p>Senior engineer.</p>");
  });

  it("does not update when creating the resume fails", async () => {
    const client = makeClient();
    vi.mocked(client.createResume).mockRejectedValue(new Error("slug taken"));

    await expect(generateResume(client, input, () => "id")).rejects.toThrow(
      "slug taken",
    );
    expect(client.getResume).not.toHaveBeenCalled();
    expect(client.updateResume).not.toHaveBeenCalled();
  });
});
