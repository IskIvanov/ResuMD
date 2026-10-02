import { describe, it, expect } from "vitest";
import {
  CodecMessage,
  decodeBase64,
  encodeBase64,
  encodeVerified,
} from "./codec.ts";
import {
  corruptingDecoder,
  NOT_BASE64,
  PDF_BASE64,
  PDF_BYTES,
  PDF_DATA_URL,
} from "./mocks.ts";
import { Base64Message } from "./schema.ts";

describe("encodeBase64", () => {
  it("encodes bytes as bare base64", () => {
    expect(encodeBase64(PDF_BYTES)).toBe(PDF_BASE64);
  });
});

describe("decodeBase64", () => {
  it("decodes bare base64 back to the bytes", () => {
    expect(decodeBase64(PDF_BASE64)).toEqual(PDF_BYTES);
  });

  it("rejects a data URL prefix", () => {
    expect(() => decodeBase64(PDF_DATA_URL)).toThrow(Base64Message.DataUrl);
  });

  it("rejects text outside the base64 alphabet", () => {
    expect(() => decodeBase64(NOT_BASE64)).toThrow(Base64Message.Invalid);
  });

  it("rejects empty text", () => {
    expect(() => decodeBase64("")).toThrow(Base64Message.Empty);
  });
});

describe("encodeVerified", () => {
  it("returns the base64 when it decodes back to the same bytes", () => {
    expect(encodeVerified(PDF_BYTES)).toBe(PDF_BASE64);
  });

  it("throws when the decoded bytes differ", () => {
    expect(() => encodeVerified(PDF_BYTES, corruptingDecoder)).toThrow(
      CodecMessage.RoundTripFailed,
    );
  });
});
