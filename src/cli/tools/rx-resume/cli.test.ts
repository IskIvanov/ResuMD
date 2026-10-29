import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { resolve } from "path";
import {
  CoverLetterTemplate,
  RxResumeEnvVar,
} from "../../../rx-resume/index.ts";
import type { Env } from "../../../utils/types.ts";
import { CliError, isCliError } from "../../errors.ts";
import { buildMenu } from "../../menu.ts";
import { promptOptions } from "../../prompt-options.ts";
import { TOOLS } from "../../registry.ts";
import { runCli } from "../../run-cli.ts";
import { pathSchema, toValidator } from "../../schema.ts";
import {
  type CliDeps,
  CliErrorCode,
  CliLabel,
  ExitCode,
  FileExtension,
  MenuAction,
  type MenuItem,
  type MenuValue,
  type PathContext,
  Platform,
  type Prompter,
  type RunContext,
  type ToolDefinition,
} from "../../types.ts";
import { deleteCoverLetterTool } from "./delete-cover-letter.ts";
import { generateCoverLetterTool } from "./generate-cover-letter.ts";
import { generateTool } from "./generate-resume.ts";
import { updateCoverLetterTool } from "./update-cover-letter.ts";
import { updateTool } from "./update-resume.ts";

// ─── Paths and settings ───────────────────────────────────────────────────────

const CWD = "/work/resume-tools";

/** A file system holding only resume/Resume.md and cv.md, under CWD. */
const pathContext: PathContext = {
  cwd: CWD,
  exists: (absolutePath) =>
    ["resume/Resume.md", "cv.md"].some(
      (file) => resolve(CWD, file) === absolutePath,
    ),
};

/** Runs a tool from CWD with no settings, so an API tool fails before a request. */
const runContext: RunContext = { cwd: CWD, env: {} };

/** Every setting any registered tool needs, so every preflight passes. */
const fullEnv: Env = {
  [RxResumeEnvVar.ApiKey]: "key",
  [RxResumeEnvVar.BaseUrl]: "https://rx.example/api/openapi",
  [RxResumeEnvVar.AppUrl]: "https://rx.example",
};

// ─── Prompter ─────────────────────────────────────────────────────────────────

/** Answers keyed by prompt message: select/input take text, checkbox a list, confirm a boolean. */
type PromptScript = Readonly<
  Record<string, string | readonly string[] | boolean>
>;

/**
 * A Prompter that answers from a script keyed by prompt message.
 *
 * - select picks the first enabled choice whose name starts with the answer
 * - input runs the prompt's validator and throws if the answer is rejected
 * - checkbox picks the choices whose value is in the answer list
 * - any prompt missing from the script throws
 */
function createFakePrompter(script: PromptScript): Prompter {
  const answer = (message: string): PromptScript[string] => {
    if (!(message in script)) throw new Error(`Unscripted prompt: ${message}`);
    return script[message];
  };

  return {
    async select({ message, choices }) {
      const text = String(answer(message));
      const choice = choices.find(
        (item) =>
          "value" in item && item.name.startsWith(text) && !item.disabled,
      );
      if (!choice || !("value" in choice))
        throw new Error(`No enabled choice "${text}" in ${message}`);
      return choice.value;
    },
    async input({ message, validate }) {
      const text = String(answer(message));
      const verdict = validate ? validate(text) : true;
      if (verdict !== true) throw new Error(`Rejected "${text}": ${verdict}`);
      return text;
    },
    async checkbox({ message, choices }) {
      const picked = answer(message);
      const values = Array.isArray(picked) ? picked : [];
      return choices
        .filter((choice) => values.includes(String(choice.value)))
        .map((choice) => choice.value);
    },
    async confirm({ message }) {
      return answer(message) === true;
    },
  };
}

/** The prompt message of one of a tool's options, so a script answers the tool's real prompts. */
function promptFor(tool: ToolDefinition, flag: string): string {
  const option = tool.options.find((candidate) => candidate.flag === flag);
  if (!option) throw new Error(`${tool.id} has no --${flag}`);
  return option.message;
}

/** Fills generate-rx-resume's required options and ticks nothing optional. */
const generateRequiredScript: PromptScript = {
  [promptFor(generateTool, "resume")]: "resume/Resume.md",
  [promptFor(generateTool, "name")]: "Jane Doe",
  [CliLabel.OptionalFlags]: [],
};

/** generate-cover-letter's required flags; the letter needn't exist to parse. */
const GENERATE_LETTER_ARGV: readonly string[] = [
  "--letter",
  "letter.md",
  "--name",
  "Acme — Frontend",
  "--resume-id",
  "resume-1",
];

// ─── runCli harness ───────────────────────────────────────────────────────────

/**
 * Keeps a tool's id, options and usage, and replaces only its run, so a test
 * can drive the real tool through the CLI without touching files or APIs.
 */
function withRecordedRuns(tool: ToolDefinition): {
  tool: ToolDefinition;
  calls: string[][];
} {
  const calls: string[][] = [];
  return {
    tool: {
      ...tool,
      run: async (argv) => {
        calls.push([...argv]);
      },
    },
    calls,
  };
}

/** Keeps a tool's declaration and replaces its run with one that throws `error`. */
function withFailingRun(tool: ToolDefinition, error: unknown): ToolDefinition {
  return {
    ...tool,
    run: async () => {
      throw error;
    },
  };
}

/** Builds runCli dependencies that answer from a script and capture output. */
function createCliHarness(
  tools: readonly ToolDefinition[],
  script: PromptScript,
  overrides: Partial<CliDeps> = {},
): { deps: CliDeps; output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  const deps: CliDeps = {
    argv: [],
    tools,
    prompter: createFakePrompter(script),
    env: {},
    isTTY: true,
    pathContext,
    log: (line) => output.push(line),
    logError: (line) => errors.push(line),
    ...overrides,
  };
  return { deps, output, errors };
}

// ─── pathSchema ───────────────────────────────────────────────────────────────

describe("pathSchema", () => {
  const validate = toValidator(
    pathSchema(
      { extensions: [FileExtension.Markdown], mustExist: true },
      pathContext,
    ),
  );

  it("accepts an existing file with a supported extension", () => {
    expect(validate("resume/Resume.md")).toBe(true);
  });

  it("rejects an unsupported extension", () => {
    expect(validate("Resume.cp")).toBe(
      'Unsupported format ".cp" — expected .md',
    );
  });

  it("rejects a missing file", () => {
    expect(validate("nope.md")).toBe("File not found: nope.md");
  });
});

// ─── parse ────────────────────────────────────────────────────────────────────

describe("parse", () => {
  it("resolves paths from cwd and fills defaults from earlier answers", () => {
    expect(
      generateTool.parse(
        ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
        CWD,
      ),
    ).toEqual({
      resume: resolve(CWD, "resume/Resume.md"),
      name: "Jane Doe",
      slug: "jane-doe",
      tags: [],
    });
  });

  it("keeps a given answer over its default and splits a list", () => {
    const values = generateTool.parse(
      [
        "--resume",
        "/abs/Resume.md",
        "--name",
        "Jane",
        "--slug",
        "jd",
        "--tags",
        "a, b,",
      ],
      CWD,
    );

    expect(values).toMatchObject({
      resume: "/abs/Resume.md",
      slug: "jd",
      tags: ["a", "b"],
    });
  });

  it("throws a CliError with the usage when a required flag is missing", () => {
    const parseWithoutName = () =>
      generateTool.parse(["--resume", "r.md"], CWD);

    expect(parseWithoutName).toThrow(CliError);
    expect(parseWithoutName).toThrow(
      `--name <name> is required\n${generateTool.usage}`,
    );
  });

  it("throws on an unknown flag", () => {
    expect(() =>
      generateTool.parse(
        ["--resume", "r.md", "--name", "Jane", "--nope", "x"],
        CWD,
      ),
    ).toThrow();
  });

  it("parses a choice into one of its values, typed as their union", () => {
    const values = generateCoverLetterTool.parse(
      [...GENERATE_LETTER_ARGV, "--template", "onyx"],
      CWD,
    );

    expect(values.template).toBe(CoverLetterTemplate.Onyx);
    expectTypeOf(values.template).toEqualTypeOf<
      CoverLetterTemplate | undefined
    >();
  });

  it("rejects a value that isn't one of the choices", () => {
    expect(() =>
      generateCoverLetterTool.parse(
        [...GENERATE_LETTER_ARGV, "--template", "charizard"],
        CWD,
      ),
    ).toThrow(
      expect.objectContaining({
        reason: expect.objectContaining({ code: CliErrorCode.InvalidChoice }),
        message: expect.stringContaining("--template must be one of azurill"),
      }),
    );
  });

  it("runs the tool with the parsed values and the run context's env", async () => {
    // The empty env stops the tool at its config check, before any request.
    await expect(
      generateCoverLetterTool.run(GENERATE_LETTER_ARGV, runContext),
    ).rejects.toThrow("Missing RXRESUME_API_KEY");
  });
});

// ─── promptOptions ────────────────────────────────────────────────────────────

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
    const prompter = createFakePrompter({
      [promptFor(generateCoverLetterTool, "letter")]: "cv.md",
      [promptFor(generateCoverLetterTool, "name")]: "Acme — Frontend",
      [promptFor(generateCoverLetterTool, "resume-id")]: "resume-1",
      [CliLabel.OptionalFlags]: ["template"],
      [promptFor(generateCoverLetterTool, "template")]: "onyx",
    });
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
      [promptFor(updateCoverLetterTool, "id")]: id,
      [promptFor(updateCoverLetterTool, "letter")]: "cv.md",
      [CliLabel.OptionalFlags]: [],
    });

    const argv = await promptOptions(
      updateCoverLetterTool.options,
      prompter,
      pathContext,
    );

    expect(argv).toEqual(expect.arrayContaining(["--id", id]));
  });
});

// ─── TOOLS ────────────────────────────────────────────────────────────────────

/** Every tool's usage line, as `bun run cli` prints it, keyed by tool id. */
const USAGE_BY_TOOL_ID: Readonly<Record<string, string>> = {
  "generate-rx-resume":
    "Usage: bun run cli generate-rx-resume --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]",
  "update-rx-resume":
    "Usage: bun run cli update-rx-resume --id <id> --resume <path>",
  "delete-rx-resume": "Usage: bun run cli delete-rx-resume --id <id>",
  "generate-cover-letter":
    "Usage: bun run cli generate-cover-letter --letter <path> --name <name> --resume-id <resume-id> [--application-id <application-id>] [--company <company>] [--template <template>]",
  "update-cover-letter":
    "Usage: bun run cli update-cover-letter --id <id> --letter <path> [--name <name>] [--company <company>] [--resume-id <resume-id>] [--application-id <application-id>] [--template <template>]",
  "delete-cover-letter": "Usage: bun run cli delete-cover-letter --id <id>",
};

/** A menu entry as one line: its heading, its tool's id, or its action. */
function menuLine(item: MenuItem<MenuValue>): string {
  if ("separator" in item) return item.separator;
  if (typeof item.value === "string") return item.value;
  return item.value.id;
}

/** The tool's own menu entry, under its platform heading. */
function menuEntry(tool: ToolDefinition, env: Env): MenuItem<MenuValue> {
  return buildMenu([tool], env)[1];
}

describe("TOOLS", () => {
  it("lists every tool under its platform heading, in registry order, then Exit", () => {
    expect(buildMenu(TOOLS, fullEnv).map(menuLine)).toEqual([
      `── ${Platform.ReactiveResume} ──`,
      "generate-rx-resume",
      "update-rx-resume",
      "delete-rx-resume",
      "generate-cover-letter",
      "update-cover-letter",
      "delete-cover-letter",
      MenuAction.Exit,
    ]);
  });

  it.each(TOOLS)(
    "runs $id as `bun run cli $id` with its usage line",
    (tool) => {
      expect(tool.command).toBe(`bun run cli ${tool.id}`);
      expect(tool.usage).toBe(USAGE_BY_TOOL_ID[tool.id]);
    },
  );

  it.each(TOOLS)(
    "disables $id with the reason until .env has its settings",
    (tool) => {
      expect(menuEntry(tool, {})).toMatchObject({
        disabled: `${CliLabel.Unavailable}: ${tool.preflight?.({})}`,
      });
      expect(menuEntry(tool, fullEnv)).not.toHaveProperty("disabled");
    },
  );

  it.each(TOOLS)(
    "rejects $id without its required flags, before doing any work",
    async (tool) => {
      const error = await tool.run([], runContext).catch((e: unknown) => e);

      expect(isCliError(error, CliErrorCode.MissingOption)).toBe(true);
    },
  );
});

// ─── runCli ───────────────────────────────────────────────────────────────────

describe("runCli", () => {
  it("prints each tool's usage and fails without a terminal", async () => {
    const { deps, errors } = createCliHarness(
      [updateTool],
      {},
      { isTTY: false },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(updateTool.usage);
  });

  it("exits cleanly when Exit is picked", async () => {
    const { tool, calls } = withRecordedRuns(updateTool);
    const { deps } = createCliHarness([tool], {
      [CliLabel.PickTool]: CliLabel.Exit,
    });

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("prints the command and runs the tool with the answers", async () => {
    const { tool, calls } = withRecordedRuns(updateTool);
    const { deps, output } = createCliHarness(
      [tool],
      {
        [CliLabel.PickTool]: updateTool.title,
        [promptFor(updateTool, "id")]: "resume-1",
        [promptFor(updateTool, "resume")]: "resume/Resume.md",
        [CliLabel.RunIt]: true,
      },
      { env: fullEnv },
    );

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(output).toContain(
      "bun run cli update-rx-resume --id resume-1 --resume resume/Resume.md",
    );
    expect(calls).toEqual([
      ["--id", "resume-1", "--resume", "resume/Resume.md"],
    ]);
  });

  it("prints the error and fails when the tool throws", async () => {
    // Without .env the tool stops at its config check, before any request.
    const { deps, errors } = createCliHarness(
      [deleteCoverLetterTool],
      {},
      { argv: ["delete-cover-letter", "--id", "letter-1"] },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual([
      expect.stringContaining("Missing RXRESUME_API_KEY"),
    ]);
  });

  it("prints each cause under the error", async () => {
    const refused = new Error("Unable to connect.");
    const tool = withFailingRun(
      updateTool,
      new Error("Upload failed", {
        cause: new Error("POST failed", { cause: refused }),
      }),
    );
    const { deps, errors } = createCliHarness(
      [tool],
      {},
      { argv: ["update-rx-resume"] },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual([
      "Upload failed\n  caused by: POST failed\n  caused by: Unable to connect.",
    ]);
  });

  it("skips a cause the message already states", async () => {
    const refused = new Error("Unable to connect.");
    const tool = withFailingRun(
      updateTool,
      new Error("POST failed: Unable to connect.", { cause: refused }),
    );
    const { deps, errors } = createCliHarness(
      [tool],
      {},
      { argv: ["update-rx-resume"] },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual(["POST failed: Unable to connect."]);
  });

  it("runs the tool named by the first argument, without the menu", async () => {
    const { tool, calls } = withRecordedRuns(updateTool);
    const flags = ["--id", "resume-1", "--resume", "resume/Resume.md"];
    const { deps } = createCliHarness(
      [tool],
      {},
      { argv: ["update-rx-resume", ...flags], isTTY: false },
    );

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([flags]);
  });

  it("lists every tool's usage and fails for an unknown tool", async () => {
    const { tool, calls } = withRecordedRuns(updateTool);
    const { deps, errors } = createCliHarness([tool], {}, { argv: ["nope"] });

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(`${CliLabel.UnknownTool} "nope"`);
    expect(errors.join("\n")).toContain(tool.usage);
    expect(calls).toEqual([]);
  });

  it("prints Cancelled and exits 130 on Ctrl+C", async () => {
    const cancel = async (): Promise<never> => {
      throw new CliError({ code: CliErrorCode.PromptCancelled });
    };
    const { deps, errors } = createCliHarness(
      [updateTool],
      {},
      {
        prompter: {
          select: cancel,
          input: cancel,
          checkbox: cancel,
          confirm: cancel,
        },
      },
    );

    expect(await runCli(deps)).toBe(ExitCode.Cancelled);
    expect(errors).toEqual([CliLabel.Cancelled]);
  });
});
