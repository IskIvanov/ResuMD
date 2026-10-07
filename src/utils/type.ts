/**
 * type.ts
 *
 * Generic type helpers.
 */

/**
 * The union of an object's property values, e.g. of an `as const` object
 * that lists a fixed set of values.
 *
 * @example
 * const Mode = { Test: "test", Live: "live" } as const;
 * type Mode = ValueOf<typeof Mode>; // "test" | "live"
 */
export type ValueOf<TObject> = TObject[keyof TObject];
