import { describe, it, expect } from "vitest";
import { failureOf, ReasonedError } from "./error.ts";

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

describe("failureOf", () => {
  it("returns what the attempt threw, or undefined when it succeeds", () => {
    expect(failureOf(() => "fine")).toBeUndefined();
    expect(
      failureOf(() => {
        throw new Error("Missing KEY");
      }),
    ).toBe("Missing KEY");
    expect(
      failureOf(() => {
        throw "Missing KEY";
      }),
    ).toBe("Missing KEY");
  });
});
