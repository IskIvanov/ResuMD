/**
 * record.ts
 *
 * Generic helpers that filter, fill or rename an object's entries.
 */

import { kebabToCamel } from "./string.ts";
import type { CamelCaseKeys, DefaultEntry } from "./types.ts";

/**
 * Drops the fields that are undefined, e.g. so an optional value that wasn't
 * given isn't sent.
 *
 * @param object - Any plain object.
 * @returns A copy without its undefined fields; `null`, `0` and `""` stay.
 *
 * @example
 * omitUndefined({ name: "Acme", template: undefined }); // { name: "Acme" }
 */
export function omitUndefined<TObject extends object>(
  object: TObject,
): Partial<TObject> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<TObject>;
}

/**
 * Keeps the entries whose value is a non-empty string.
 *
 * @param record - Values of any type, keyed by name.
 * @returns Only the non-empty string entries.
 *
 * @example
 * pickNonEmptyStrings({ id: "r1", tags: "", verbose: true }); // { id: "r1" }
 */
export function pickNonEmptyStrings(
  record: Readonly<Record<string, unknown>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

/**
 * Fills each key that has no value from its default, in order. A default sees
 * the given entries and every default filled before it.
 *
 * @param given - The entries supplied, keyed by name.
 * @param defaults - Each key with its default builder, in the order to fill
 *   them. A key that already has a value, or has no builder, is skipped.
 * @returns A copy of `given` plus each default that built a value.
 *
 * @example
 * fillDefaults({ name: "Jane" }, [["slug", (known) => known.name.toLowerCase()]]);
 * // { name: "Jane", slug: "jane" }
 */
export function fillDefaults(
  given: Readonly<Record<string, string>>,
  defaults: readonly DefaultEntry[],
): Record<string, string> {
  return defaults.reduce<Record<string, string>>(
    (known, [key, build]) => {
      if (known[key] !== undefined || build === undefined) return known;
      const value = build(known);
      if (value === undefined) return known;
      return { ...known, [key]: value };
    },
    { ...given },
  );
}

/**
 * Renames an object's kebab-case keys to camelCase, e.g. parsed CLI flags to
 * the option fields a domain function takes.
 *
 * @param object - Any plain object.
 * @returns A copy with each key passed through kebabToCamel. Its type maps
 *   each key the same way, so a flag that doesn't match a field fails to
 *   compile where the copy is used.
 *
 * @example
 * camelCaseKeys({ "resume-id": "r1", name: "Acme" }); // { resumeId: "r1", name: "Acme" }
 */
export function camelCaseKeys<TObject extends object>(
  object: TObject,
): CamelCaseKeys<TObject> {
  // Each key goes through kebabToCamel, which CamelCaseKeys mirrors; the
  // compiler can't follow keys through Object.entries.
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [kebabToCamel(key), value]),
  ) as CamelCaseKeys<TObject>;
}
