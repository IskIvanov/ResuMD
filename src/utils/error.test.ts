import { describe, it, expect } from "vitest";
import { ReasonedError } from "./error.ts";

type FieldTooLongReason = { code: "TOO_LONG"; field: string };

class TooLongError extends ReasonedError<FieldTooLongReason> {
  constructor(reason: FieldTooLongReason, options?: ErrorOptions) {
    super(reason, `${reason.field} is too long`, options);
  }
}

describe("ReasonedError", () => {
  it("keeps the reason and cause, and is named after its subclass", () => {
    const cause = new Error("root");
    const error = new TooLongError(
      { code: "TOO_LONG", field: "name" },
      { cause },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "TooLongError",
      message: "name is too long",
      reason: { code: "TOO_LONG", field: "name" },
      cause,
    });
  });
});
