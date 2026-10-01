import { describe, it, expect } from "vitest";
import { promptOptions } from "./prompt-options.ts";
import {
  createFakePrompter,
  pathContext,
  StubFlag,
  StubMessage,
  stubOptions,
  stubRequiredScript,
} from "./mocks.ts";
import { CliLabel } from "./types.ts";

describe("promptOptions", () => {
  it("builds argv from the required options only", async () => {
    const prompter = createFakePrompter(stubRequiredScript);

    const argv = await promptOptions(stubOptions, prompter, pathContext);

    expect(argv).toEqual([
      "--resume",
      "resume/Resume.md",
      "--name",
      "Jane Doe",
    ]);
  });

  it("prompts for a ticked optional flag and adds it to argv", async () => {
    const prompter = createFakePrompter({
      ...stubRequiredScript,
      [CliLabel.OptionalFlags]: [StubFlag.Slug],
      [StubMessage.Slug]: "jane",
    });

    const argv = await promptOptions(stubOptions, prompter, pathContext);

    expect(argv).toEqual([
      "--resume",
      "resume/Resume.md",
      "--name",
      "Jane Doe",
      "--slug",
      "jane",
    ]);
  });
});
