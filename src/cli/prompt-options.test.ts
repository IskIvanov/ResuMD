import { describe, it, expect, vi } from "vitest";
import { CoverLetterTemplate } from "../rx-resume/types.ts";
import { promptOptions } from "./prompt-options.ts";
import {
  createFakePrompter,
  generateLetterTemplateScript,
  generateRequiredScript,
  pathContext,
  promptFor,
  updateLetterRequiredScript,
} from "./mocks.ts";
import { generateCoverLetterTool } from "./tools/generate-cover-letter.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { updateCoverLetterTool } from "./tools/update-cover-letter.ts";
import { CliLabel } from "./types.ts";

describe("promptOptions", () => {
  it("builds argv from the required options only", async () => {
    const prompter = createFakePrompter(generateRequiredScript);

    const argv = await promptOptions(
      generateTool.options,
      prompter,
      pathContext,
    );

    expect(argv).toEqual([
      "--resume",
      "resume/Resume.md",
      "--name",
      "Jane Doe",
    ]);
  });

  it("shows each optional flag's default and prompts for a ticked one", async () => {
    const prompter = createFakePrompter({
      ...generateRequiredScript,
      [CliLabel.OptionalFlags]: ["slug"],
      [promptFor(generateTool, "slug")]: "jane",
    });
    const checkbox = vi.spyOn(prompter, "checkbox");

    const argv = await promptOptions(
      generateTool.options,
      prompter,
      pathContext,
    );

    expect(checkbox).toHaveBeenCalledWith({
      message: CliLabel.OptionalFlags,
      choices: [
        { name: "--slug (default: jane-doe)", value: "slug" },
        { name: "--tags", value: "tags" },
      ],
    });
    expect(argv).toEqual([
      "--resume",
      "resume/Resume.md",
      "--name",
      "Jane Doe",
      "--slug",
      "jane",
    ]);
  });

  it("offers every choice of a choice option in a select", async () => {
    const prompter = createFakePrompter(generateLetterTemplateScript);
    const select = vi.spyOn(prompter, "select");

    const argv = await promptOptions(
      generateCoverLetterTool.options,
      prompter,
      pathContext,
    );

    expect(select).toHaveBeenCalledWith({
      message: promptFor(generateCoverLetterTool, "template"),
      choices: Object.values(CoverLetterTemplate).map((template) => ({
        name: template,
        value: template,
      })),
    });
    expect(argv).toEqual(expect.arrayContaining(["--template", "onyx"]));
  });

  it("accepts an id that is a UUID", async () => {
    const id = "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c";
    const prompter = createFakePrompter({
      ...updateLetterRequiredScript,
      [promptFor(updateCoverLetterTool, "id")]: id,
    });

    const argv = await promptOptions(
      updateCoverLetterTool.options,
      prompter,
      pathContext,
    );

    console.log(argv);

    expect(argv).toEqual(expect.arrayContaining(["--id", id]));
  });
});
