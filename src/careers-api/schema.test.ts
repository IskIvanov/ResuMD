import { describe, it, expect } from "vitest";
import {
  DUTCH_PHONE_NUMBERS,
  invalidFieldCases,
  LARGEST_CV,
  NON_DUTCH_PHONE_NUMBERS,
  OVERSIZED_CV,
  validPayload,
} from "./mocks.ts";
import {
  ApplicationMessage,
  isDutchPhoneNumber,
  validateApplicationPayload,
} from "./schema.ts";

describe("validateApplicationPayload", () => {
  it("returns a valid payload unchanged", () => {
    expect(validateApplicationPayload(validPayload)).toEqual(validPayload);
  });

  it.each(invalidFieldCases)(
    "rejects an invalid $field",
    ({ field, value, message }) => {
      expect(() =>
        validateApplicationPayload({ ...validPayload, [field]: value }),
      ).toThrow(`${field}: ${message}`);
    },
  );

  it("lists every invalid field under one heading", () => {
    expect(() =>
      validateApplicationPayload({
        ...validPayload,
        first_name: "",
        email: "jane@",
      }),
    ).toThrow(/^Invalid application:\n {2}first_name: .*\n {2}email: /);
  });

  it("accepts a request up to the size limit", () => {
    expect(() =>
      validateApplicationPayload({ ...validPayload, cv: LARGEST_CV }),
    ).not.toThrow();
  });

  it("rejects a request over the size limit, naming the CV and its size", () => {
    expect(() =>
      validateApplicationPayload({ ...validPayload, cv: OVERSIZED_CV }),
    ).toThrow(
      new RegExp(
        `cv: makes the request \\d+\\.\\d{2} MB, ${ApplicationMessage.RequestTooLarge}`,
      ),
    );
  });
});

describe("isDutchPhoneNumber", () => {
  it.each(DUTCH_PHONE_NUMBERS)("accepts %s", (phone) => {
    expect(isDutchPhoneNumber(phone)).toBe(true);
  });

  it.each(NON_DUTCH_PHONE_NUMBERS)("rejects %s", (phone) => {
    expect(isDutchPhoneNumber(phone)).toBe(false);
  });
});
