/**
 * record.ts
 *
 * Generic helpers that filter or fill an object's entries.
 */

import type { DefaultEntry } from "./types.ts";

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
 * @param entries - The entries supplied, keyed by name.
 * @param defaults - Each key with its default builder, in the order to fill
 *   them. A key that already has a value, or has no builder, is skipped.
 * @returns A copy of `entries` plus each default that built a value.
 *
 * @example
 * fillDefaults({ name: "Jane" }, [["slug", (known) => known.name.toLowerCase()]]);
 * // { name: "Jane", slug: "jane" }
 */
export function fillDefaults(
  entries: Readonly<Record<string, string>>,
  defaults: readonly DefaultEntry[],
): Record<string, string> {
  return defaults.reduce<Record<string, string>>(
    (known, [key, build]) => {
      if (known[key] !== undefined || build === undefined) return known;
      const value = build(known);
      if (value === undefined) return known;
      return { ...known, [key]: value };
    },
    { ...entries },
  );
}
