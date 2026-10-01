/**
 * slugify.ts
 *
 * Derives a Reactive Resume URL slug from a resume name.
 */

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
