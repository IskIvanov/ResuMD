/**
 * schema.ts
 *
 * Zod schema for a file sent as base64 the way APIs expect it: the bare
 * base64 text, without a `data:…;base64,` URL prefix.
 */

import { z } from "zod";

/** Messages reported for text that isn't bare base64. */
export const Base64Message = {
  Empty: "is empty",
  DataUrl:
    'has a data URL prefix; use the bare base64 without "data:…;base64,"',
  Invalid: "is not valid base64",
} as const;

const DATA_URL_PREFIX = /^data:/i;

/**
 * Bare base64: not empty, no data URL prefix, only the standard alphabet and
 * correct padding. The prefix is checked first so it gets its own message.
 */
export const Base64Schema = z
  .string()
  .min(1, { error: Base64Message.Empty, abort: true })
  .refine((text) => !DATA_URL_PREFIX.test(text), Base64Message.DataUrl)
  .pipe(z.base64(Base64Message.Invalid));
