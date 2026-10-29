/**
 * types.ts
 *
 * Generic types: type helpers and the shapes every domain shares.
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

/** Builds a missing entry's value from the entries known so far. */
type DefaultBuilder = (
  known: Readonly<Record<string, string>>,
) => string | undefined;

/** A key and the builder of its default, if it has one. */
export type DefaultEntry = readonly [
  key: string,
  build: DefaultBuilder | undefined,
];

/** Environment variables, usually `process.env` after Bun has loaded `.env`. */
export type EnvironmentVariables = Record<string, string | undefined>;

/** The subset of `fetch` a client uses; `globalThis.fetch` satisfies it. */
export type FetchFunction = (
  url: string,
  httpRequest?: RequestInit,
) => Promise<Response>;
