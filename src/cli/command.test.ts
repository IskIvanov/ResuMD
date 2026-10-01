import { describe, it, expect } from "vitest";
import { formatCommand } from "./command.ts";

describe("formatCommand", () => {
  it("appends argv to the command", () => {
    expect(
      formatCommand("bun run sync", ["--resume", "resume/Resume.md"]),
    ).toBe("bun run sync --resume resume/Resume.md");
  });

  it("quotes a value that contains a space", () => {
    expect(formatCommand("bun run stub", ["--name", "Jane Doe"])).toBe(
      'bun run stub --name "Jane Doe"',
    );
  });
});
