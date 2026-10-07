import { describe, it, expect } from "vitest";
import { LETTER_ID, LETTER_REVISION } from "../rx-resume/mocks.ts";
import { deleteCoverLetter } from "./delete.ts";
import { CoverLetterError } from "./errors.ts";
import { apiError, createFakeLetterClient, LetterMethod } from "./mocks.ts";
import { CoverLetterErrorCode } from "./types.ts";

describe("deleteCoverLetter", () => {
  it("reads the letter, moves it to Trash at its revision, then purges it", async () => {
    const { client, calls } = createFakeLetterClient();

    await deleteCoverLetter(client, LETTER_ID);

    expect(calls).toEqual([
      { method: LetterMethod.Get, args: [LETTER_ID] },
      { method: LetterMethod.Trash, args: [LETTER_ID, LETTER_REVISION] },
      { method: LetterMethod.Purge, args: [LETTER_ID] },
    ]);
  });

  it("says the letter is in Trash when the purge fails", async () => {
    const { client } = createFakeLetterClient({ failing: LetterMethod.Purge });

    const error = await deleteCoverLetter(client, LETTER_ID).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(CoverLetterError);
    expect(error).toMatchObject({
      reason: { code: CoverLetterErrorCode.LeftInTrash, id: LETTER_ID },
      message: `${apiError.message}; letter ${LETTER_ID} is in Trash`,
      cause: apiError,
    });
  });

  it("never purges when moving to Trash fails", async () => {
    const { client, calls } = createFakeLetterClient({
      failing: LetterMethod.Trash,
    });

    await expect(deleteCoverLetter(client, LETTER_ID)).rejects.toBe(apiError);
    expect(calls.map((call) => call.method)).not.toContain(LetterMethod.Purge);
  });
});
