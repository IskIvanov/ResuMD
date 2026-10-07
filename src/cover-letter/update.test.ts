import { describe, it, expect } from "vitest";
import {
  LETTER_ID,
  LETTER_REVISION,
  updateCoverLetterBody,
} from "../rx-resume/mocks.ts";
import { CoverLetterError } from "./errors.ts";
import {
  apiError,
  createFakeLetterClient,
  LetterMethod,
  structuredLetter,
} from "./mocks.ts";
import { CoverLetterErrorCode } from "./types.ts";
import { updateCoverLetter } from "./update.ts";

const build = (revision: number) => ({
  ...updateCoverLetterBody,
  expectedRevision: revision,
});

describe("updateCoverLetter", () => {
  it("reads the letter, then puts the body built at its revision", async () => {
    const { client, calls } = createFakeLetterClient();

    const letter = await updateCoverLetter(client, LETTER_ID, build);

    expect(calls).toEqual([
      { method: LetterMethod.Get, args: [LETTER_ID] },
      {
        method: LetterMethod.Update,
        args: [
          LETTER_ID,
          { ...updateCoverLetterBody, expectedRevision: LETTER_REVISION },
        ],
      },
    ]);
    expect(letter.revision).toBe(LETTER_REVISION + 1);
  });

  it("passes on the API's error when the put is rejected, without retrying", async () => {
    const { client, calls } = createFakeLetterClient({
      failing: LetterMethod.Update,
    });

    await expect(updateCoverLetter(client, LETTER_ID, build)).rejects.toBe(
      apiError,
    );
    expect(calls.map((call) => call.method)).toEqual([
      LetterMethod.Get,
      LetterMethod.Update,
    ]);
  });

  it("refuses a letter that isn't freeform, before sending an update", async () => {
    const { client, calls } = createFakeLetterClient({
      stored: structuredLetter,
    });

    const error = await updateCoverLetter(client, LETTER_ID, build).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(CoverLetterError);
    expect(error).toMatchObject({
      reason: {
        code: CoverLetterErrorCode.NotFreeform,
        id: LETTER_ID,
        layout: structuredLetter.layout,
      },
    });
    expect(calls.map((call) => call.method)).toEqual([LetterMethod.Get]);
  });
});
