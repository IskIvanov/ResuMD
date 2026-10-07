/**
 * url.ts
 *
 * Generic helpers that build URLs and paths.
 */

/** One or more slashes at the end of a URL. */
const TRAILING_SLASHES = /\/+$/;

/**
 * Drops the slashes at the end of a URL, so a path can be appended to it.
 *
 * @param url - Any URL, with or without trailing slashes.
 * @returns The URL without them.
 *
 * @example
 * trimTrailingSlashes("https://rxresu.me/"); // "https://rxresu.me"
 */
export function trimTrailingSlashes(url: string): string {
  return url.replace(TRAILING_SLASHES, "");
}

/**
 * Builds the path of one item in a collection.
 *
 * @param collection - The collection's path, e.g. `/resumes`.
 * @param id - The item's id; it's URL-encoded.
 * @returns The collection path, a slash and the encoded id.
 *
 * @example
 * itemPath("/resumes", "a/b"); // "/resumes/a%2Fb"
 */
export function itemPath(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}
