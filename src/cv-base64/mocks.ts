/**
 * mocks.ts
 *
 * Every fixture the cv-base64 tests use: a tiny PDF-like file, its base64 and
 * text that isn't bare base64. Typed constants and small factories only.
 */

import type { Base64Decoder } from "./types.ts";

/** The bytes of "%PDF-1.7\n", the first line of a PDF. */
export const PDF_BYTES = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a,
]);

/** PDF_BYTES as bare base64. */
export const PDF_BASE64 = "JVBERi0xLjcK";

/** PDF_BASE64 behind the data URL prefix the API rejects. */
export const PDF_DATA_URL = `data:application/pdf;base64,${PDF_BASE64}`;

/** Has a character outside the base64 alphabet. */
export const NOT_BASE64 = "JVBERi0x!jcK";

/** A decoder that never gives back the bytes it was given. */
export const corruptingDecoder: Base64Decoder = () => new Uint8Array([0]);
