/**
 * types.ts
 *
 * Every type cv-base64 declares, in one place.
 */

/** Decodes bare base64 text into bytes; decodeBase64 in production. */
export type Base64Decoder = (text: string) => Uint8Array;

/** Options parsed from the encode-cv command line. */
export interface EncodeOptions {
  /** Absolute path to the CV to encode. */
  cv: string;
  /** Absolute path the base64 text is written to; overwritten if it exists. */
  out: string;
}

/** Options parsed from the decode-cv command line. */
export interface DecodeOptions {
  /** Absolute path to a file holding bare base64 text. */
  base64: string;
  /** Absolute path the decoded file is written to; must not exist yet. */
  out: string;
}
