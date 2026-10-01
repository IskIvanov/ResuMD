import { describe, it, expect, vi } from "vitest";
import { patchResumeData } from "./patch.ts";
import type { PatchClient, Resume, ResumeData } from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Contents are irrelevant: patchResumeData only passes data through.
const currentData = { summary: { content: "current" } } as ResumeData;
const patchedData = { summary: { content: "patched" } } as ResumeData;

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

function makeClient(): PatchClient {
  return {
    getResume: vi.fn().mockResolvedValue(makeResume(currentData)),
    updateResume: vi
      .fn()
      .mockImplementation(async (_id: string, body: { data: ResumeData }) =>
        makeResume(body.data),
      ),
  };
}

// ─── patchResumeData ──────────────────────────────────────────────────────────

describe("patchResumeData", () => {
  it("saves the patched data of the fetched resume under the same id", async () => {
    const client = makeClient();
    const patch = vi.fn().mockReturnValue(patchedData);

    const resume = await patchResumeData(client, "resume-1", patch);

    expect(client.getResume).toHaveBeenCalledWith("resume-1");
    expect(patch).toHaveBeenCalledWith(currentData);
    expect(client.updateResume).toHaveBeenCalledWith("resume-1", {
      data: patchedData,
    });
    expect(resume.data).toBe(patchedData);
  });

  it("does not save when fetching the resume fails", async () => {
    const client = makeClient();
    vi.mocked(client.getResume).mockRejectedValue(new Error("not found"));

    await expect(
      patchResumeData(client, "resume-1", () => patchedData),
    ).rejects.toThrow("not found");
    expect(client.updateResume).not.toHaveBeenCalled();
  });
});
