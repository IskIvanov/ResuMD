/**
 * codec.ts
 *
 * Converts a file's bytes to bare base64 text and back. Node's own decoder
 * skips characters it doesn't recognise, so text is checked against
 * Base64Schema first: a bad file fails loudly instead of decoding to garbage.
 */

import { Base64Schema } from "./schema.ts";
import type { Base64Decoder } from "./types.ts";

/** Errors the codec throws. */
export enum CodecMessage {
  InvalidBase64 = "Invalid base64:",
  RoundTripFailed =
    "Round trip failed: the base64 does not decode back to the same bytes",
}

const BASE64 = "base64";

/**
 * Encodes bytes as bare base64.
 *
 * @param bytes - The file's contents.
 * @returns Base64 text with padding and no data URL prefix.
 *
 * @example
 * encodeBase64(readFileSync("Resume.pdf")); // "JVBERi0xLjcK…"
 */
export function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString(BASE64);
}

/**
 * Decodes bare base64 into bytes.
 *
 * @param text - Base64 without a data URL prefix or whitespace.
 * @returns The decoded bytes.
 * @throws If the text is empty, has a data URL prefix or isn't valid base64.
 *
 * @example
 * decodeBase64("JVBERi0xLjcK"); // bytes of "%PDF-1.7\n"
 */
export function decodeBase64(text: string): Uint8Array {
  const result = Base64Schema.safeParse(text);
  if (!result.success) {
    const issue = result.error.issues[0].message;
    throw new Error(`${CodecMessage.InvalidBase64} ${issue}`);
  }
  return new Uint8Array(Buffer.from(result.data, BASE64));
}

/**
 * Encodes bytes as base64 and checks that decoding gives the same bytes back.
 *
 * @param bytes - The file's contents.
 * @param decode - Decoder used for the check; decodeBase64 unless a test
 *   swaps it.
 * @returns The base64 text, as encodeBase64 returns it.
 * @throws If the decoded bytes differ from `bytes`.
 *
 * @example
 * encodeVerified(readFileSync("Resume.pdf")); // "JVBERi0xLjcK…"
 */
export function encodeVerified(
  bytes: Uint8Array,
  decode: Base64Decoder = decodeBase64,
): string {
  const text = encodeBase64(bytes);
  if (!Buffer.from(decode(text)).equals(bytes)) {
    throw new Error(CodecMessage.RoundTripFailed);
  }
  return text;
}
