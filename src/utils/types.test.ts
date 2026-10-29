import { describe, it, expectTypeOf } from "vitest";
import type { ValueOf } from "./types.ts";

const Mode = { Test: "test", Live: "live" } as const;

describe("ValueOf", () => {
  it("is the union of an object's values", () => {
    expectTypeOf<ValueOf<typeof Mode>>().toEqualTypeOf<"test" | "live">();
  });
});
