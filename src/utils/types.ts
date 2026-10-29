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

/**
 * A kebab-case name in camelCase, worked out by the compiler: each word after
 * a dash is capitalized and the dashes are dropped.
 *
 * @example
 * type Field = KebabToCamel<"resume-id">; // "resumeId"
 */
export type KebabToCamel<TName extends string> =
  TName extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<KebabToCamel<Tail>>}`
    : TName;

/** An object with each kebab-case key renamed to camelCase. */
export type CamelCaseKeys<TObject extends object> = {
  [TKey in keyof TObject as TKey extends string
    ? KebabToCamel<`${TKey}`>
    : TKey]: TObject[TKey];
};

/** Builds a missing entry's value from the entries known so far. */
type DefaultBuilder = (
  known: Readonly<Record<string, string>>,
) => string | undefined;

/** A key and the builder of its default, if it has one. */
export type DefaultEntry = readonly [
  key: string,
  build: DefaultBuilder | undefined,
];

/** What went wrong: a code naming the failure, plus what its message needs. */
export interface ErrorReason {
  readonly code: string;
}

/** Environment variables, usually `process.env` after Bun has loaded `.env`. */
export type Env = Record<string, string | undefined>;

/** The subset of `fetch` a client uses; `globalThis.fetch` satisfies it. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
