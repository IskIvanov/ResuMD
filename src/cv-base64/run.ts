/**
 * run.ts
 *
 * Encodes a CV file to a base64 text file, and decodes one back, so you can
 * check what an API will receive before you send it. Encoding always checks
 * the round trip; decoding gives you a file to open and compare by eye.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { relative } from "path";
import { decodeBase64, encodeVerified } from "./codec.ts";
import type { DecodeOptions, EncodeOptions } from "./types.ts";

enum RunLabel {
  Encoded = "✓ Encoded",
  Decoded = "✓ Decoded",
  RoundTrip = "  round trip verified: the base64 decodes back to the same",
  Bytes = "bytes",
  Base64 = "base64",
  OutExists = "already exists; pass another --out so it isn't overwritten",
}

const BYTES_PER_KB = 1024;

/** Formats a byte count as kilobytes, e.g. "84.2 KB". */
function formatSize(bytes: number): string {
  return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
}

/** A path relative to the working directory, for shorter output. */
function shortPath(path: string, cwd: string): string {
  return relative(cwd, path) || path;
}

/**
 * Encodes a CV as base64, checks the round trip and writes the text.
 *
 * @param options - The CV to read and the text file to write.
 * @param cwd - Paths are printed relative to it.
 * @throws If the file can't be read or the round trip fails.
 *
 * @example
 * runEncode({ cv: "/cv/Resume.pdf", out: "/cv/Resume.pdf.base64.txt" }, "/cv");
 * // ✓ Encoded Resume.pdf (84.2 KB) → Resume.pdf.base64.txt (112.3 KB base64)
 * //   round trip verified: the base64 decodes back to the same 86221 bytes
 */
export function runEncode(options: EncodeOptions, cwd: string): void {
  const bytes = readFileSync(options.cv);
  const text = encodeVerified(bytes);
  writeFileSync(options.out, text);

  console.log(
    `${RunLabel.Encoded} ${shortPath(options.cv, cwd)} (${formatSize(bytes.length)})` +
      ` → ${shortPath(options.out, cwd)} (${formatSize(text.length)} ${RunLabel.Base64})`,
  );
  console.log(`${RunLabel.RoundTrip} ${bytes.length} ${RunLabel.Bytes}`);
}

/**
 * Decodes a base64 text file and writes the bytes to a new file.
 *
 * @param options - The text file to read and the file to create.
 * @param cwd - Paths are printed relative to it.
 * @throws If `out` already exists (so the original CV is never overwritten),
 *   or the text isn't bare base64.
 *
 * @example
 * runDecode({ base64: "/cv/Resume.pdf.base64.txt", out: "/cv/Decoded.pdf" }, "/cv");
 * // ✓ Decoded Resume.pdf.base64.txt → Decoded.pdf (84.2 KB)
 */
export function runDecode(options: DecodeOptions, cwd: string): void {
  if (existsSync(options.out)) {
    throw new Error(`${shortPath(options.out, cwd)} ${RunLabel.OutExists}`);
  }
  // Editors often add a final newline; it isn't part of the base64.
  const bytes = decodeBase64(readFileSync(options.base64, "utf-8").trim());
  writeFileSync(options.out, bytes);

  console.log(
    `${RunLabel.Decoded} ${shortPath(options.base64, cwd)} → ` +
      `${shortPath(options.out, cwd)} (${formatSize(bytes.length)})`,
  );
}
