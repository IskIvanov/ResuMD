/**
 * string.ts
 *
 * Generic string helpers: slugs, comma-separated lists and kebab-case names.
 */

import type { KebabToCamel } from "./types.ts";

/** Separates the entries of a list typed as one value: `a, b, c`. */
const LIST_SEPARATOR = ",";

/** Separates the words of a kebab-case name: `resume-id`. */
const KEBAB_SEPARATOR = "-";

/**
 * Converts a name into a URL slug: lowercase ASCII words joined by dashes.
 *
 * @param name - Any display name.
 * @returns The slug, or an empty string if the name has no letters or digits.
 *
 * @example
 * slugify("Zoë Doe — Frontend"); // "zoe-doe-frontend"
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Splits a comma-separated list, trimming each entry.
 *
 * @param value - The list as typed, or undefined when it wasn't given.
 * @returns The entries, with empty ones dropped; `[]` for no value.
 *
 * @example
 * splitList("a, b,, c"); // ["a", "b", "c"]
 */
export function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Converts a kebab-case name to camelCase, typed as the exact result.
 *
 * @param name - A kebab-case name, e.g. a CLI flag.
 * @returns The name with each word after a dash capitalized and the dashes
 *   dropped, the same way KebabToCamel computes it.
 *
 * @example
 * kebabToCamel("application-id"); // "applicationId"
 */
export function kebabToCamel<TName extends string>(
  name: TName,
): KebabToCamel<TName> {
  const [head = "", ...tail] = name.split(KEBAB_SEPARATOR);
  const words = tail.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
  // Splits exactly where KebabToCamel's pattern does, so the string it builds
  // is the type's result; the compiler can't follow string methods.
  return [head, ...words].join("") as KebabToCamel<TName>;
}
