/**
 * string.ts
 *
 * Generic string helpers: slugs and comma-separated lists.
 */

/** Separates the entries of a list typed as one value: `a, b, c`. */
const LIST_SEPARATOR = ",";

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
