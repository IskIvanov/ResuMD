import { describe, it, expect } from "vitest";
import { createCoverLetterBody } from "../rx-resume/mocks.ts";
import { generateCoverLetter } from "./generate.ts";
import { createFakeLetterClient, LetterMethod } from "./mocks.ts";

describe("generateCoverLetter", () => {
  it("posts the body once and returns the new letter", async () => {
    const { client, calls } = createFakeLetterClient();

    const letter = await generateCoverLetter(client, createCoverLetterBody);

    expect(calls).toEqual([
      { method: LetterMethod.Create, args: [createCoverLetterBody] },
    ]);
    expect(letter).toMatchObject({
      name: createCoverLetterBody.name,
      revision: 1,
    });
  });
});
