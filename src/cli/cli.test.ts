import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { resolve } from "path";
import { CoverLetterTemplate, EnvVar } from "../rx-resume/api/types.ts";
import {
  deleteCoverLetterTool,
  generateCoverLetterTool,
  generateResumeTool,
  RX_RESUME_TOOLS,
  updateCoverLetterTool,
  updateResumeTool,
} from "../rx-resume/index.ts";
import type { Env } from "../utils/types.ts";
import { promptOptions } from "./prompt.ts";
import { buildMenu, PromptCancelled, runCli } from "./run-cli.ts";
import {
  type CliDeps,
  type Choice,
  ExitCode,
  MenuAction,
  type MenuValue,
  type PathContext,
  type Prompter,
  type RunContext,
  type ToolDefinition,
} from "./types.ts";

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

/** Fails the test that reaches it: CLI tests never touch files or the API. */
function unreachable(): never {
  throw new Error("A CLI test reached the outside world");
}

/** Runs a tool from CWD with no settings, so an API tool fails before a request. */
const runContext: RunContext = {
  cwd: CWD,
  env: {},
  fetch: unreachable,
  newId: unreachable,
  today: unreachable,
  now: unreachable,
  readFile: unreachable,
  log: unreachable,
  logError: unreachable,
};

/** Every setting any registered tool needs, so every preflight passes. */
const fullEnv: Env = {
  [EnvVar.ApiKey]: "key",
  [EnvVar.BaseUrl]: "https://rx.example/api/openapi",
  [EnvVar.AppUrl]: "https://rx.example",
};

// ─── Prompter ─────────────────────────────────────────────────────────────────

/** The CLI's own prompts, as the user sees them. */
const PICK_TOOL = "Which tool do you want to run?";
const OPTIONAL_FLAGS = "Set any optional flags?";
const RUN_IT = "Run it?";

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
        (item) => item.name.startsWith(text) && !item.disabled,
      );
      if (!choice) throw new Error(`No enabled choice "${text}" in ${message}`);
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
  [promptFor(generateResumeTool, "resume")]: "resume/Resume.md",
  [promptFor(generateResumeTool, "name")]: "Jane Doe",
  [OPTIONAL_FLAGS]: [],
};

/** A cover-letter id as Reactive Resume gives it: a UUID. */
const LETTER_ID = "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c";

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
    ...runContext,
    argv: [],
    tools,
    prompter: createFakePrompter(script),
    isTTY: true,
    exists: pathContext.exists,
    log: (line) => output.push(line),
    logError: (line) => errors.push(line),
    ...overrides,
  };
  return { deps, output, errors };
}

// ─── parse ────────────────────────────────────────────────────────────────────

describe("parse", () => {
  it("resolves paths from cwd and fills defaults from earlier answers", () => {
    expect(
      generateResumeTool.parse(
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
    const values = generateResumeTool.parse(
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

  it("throws with the usage when a required flag is missing", () => {
    const parseWithoutName = () =>
      generateResumeTool.parse(["--resume", "r.md"], CWD);

    expect(parseWithoutName).toThrow(
      `--name <name> is required\n${generateResumeTool.usage}`,
    );
  });

  it("throws on an unknown flag", () => {
    expect(() =>
      generateResumeTool.parse(
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
        message: expect.stringContaining("--template must be one of azurill"),
      }),
    );
  });

  it("rejects a value its option's schema refuses", () => {
    expect(() =>
      updateCoverLetterTool.parse(
        ["--id", "letter-1", "--letter", "cv.md"],
        CWD,
      ),
    ).toThrow("--id: Field must accept a valid UUID");
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
      generateResumeTool.options,
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
      [OPTIONAL_FLAGS]: ["slug"],
      [promptFor(generateResumeTool, "slug")]: "jane",
    });
    const checkbox = vi.spyOn(prompter, "checkbox");

    const argv = await promptOptions(
      generateResumeTool.options,
      prompter,
      pathContext,
    );

    expect(checkbox).toHaveBeenCalledWith({
      message: OPTIONAL_FLAGS,
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
      [OPTIONAL_FLAGS]: ["template"],
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

  describe("checks a typed path", () => {
    /** Answers update-rx-resume's prompts, with `path` for --resume. */
    function promptForResume(path: string): Promise<string[]> {
      const prompter = createFakePrompter({
        [promptFor(updateResumeTool, "id")]: "resume-1",
        [promptFor(updateResumeTool, "resume")]: path,
      });
      return promptOptions(updateResumeTool.options, prompter, pathContext);
    }

    it("accepts an existing file with a supported extension", async () => {
      expect(await promptForResume("resume/Resume.md")).toEqual([
        "--id",
        "resume-1",
        "--resume",
        "resume/Resume.md",
      ]);
    });

    it("rejects an unsupported extension", async () => {
      await expect(promptForResume("Resume.cp")).rejects.toThrow(
        'Unsupported format ".cp" — expected .md',
      );
    });

    it("rejects a missing file", async () => {
      await expect(promptForResume("nope.md")).rejects.toThrow(
        "File not found: nope.md",
      );
    });
  });

  it("rejects a required answer left blank", async () => {
    const prompter = createFakePrompter({
      [promptFor(updateResumeTool, "id")]: "  ",
      [promptFor(updateResumeTool, "resume")]: "resume/Resume.md",
    });

    await expect(
      promptOptions(updateResumeTool.options, prompter, pathContext),
    ).rejects.toThrow('Rejected "  ": A value is required');
  });

  it("accepts an id that is a UUID", async () => {
    const id = LETTER_ID;
    const prompter = createFakePrompter({
      [promptFor(updateCoverLetterTool, "id")]: id,
      [promptFor(updateCoverLetterTool, "letter")]: "cv.md",
      [OPTIONAL_FLAGS]: [],
    });

    const argv = await promptOptions(
      updateCoverLetterTool.options,
      prompter,
      pathContext,
    );

    expect(argv).toEqual(expect.arrayContaining(["--id", id]));
  });
});

// ─── RX_RESUME_TOOLS ─────────────────────────────────────────────────────────

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

/** A menu entry as one line: its tool's id, or its action. */
function menuLine(item: Choice<MenuValue>): string {
  if (typeof item.value === "string") return item.value;
  return item.value.id;
}

/** The tool's own menu entry. */
function menuEntry(tool: ToolDefinition, env: Env): Choice<MenuValue> {
  return buildMenu([tool], env)[0];
}

describe("RX_RESUME_TOOLS", () => {
  it("lists every tool in menu order, then Exit", () => {
    expect(buildMenu(RX_RESUME_TOOLS, fullEnv).map(menuLine)).toEqual([
      "generate-rx-resume",
      "update-rx-resume",
      "delete-rx-resume",
      "generate-cover-letter",
      "update-cover-letter",
      "delete-cover-letter",
      MenuAction.Exit,
    ]);
  });

  it.each(RX_RESUME_TOOLS)(
    "runs $id as `bun run cli $id` with its usage line",
    (tool) => {
      expect(tool.command).toBe(`bun run cli ${tool.id}`);
      expect(tool.usage).toBe(USAGE_BY_TOOL_ID[tool.id]);
    },
  );

  it.each(RX_RESUME_TOOLS)(
    "disables $id with the reason until .env has its settings",
    (tool) => {
      expect(menuEntry(tool, {})).toMatchObject({
        disabled: `Not available: ${tool.preflight?.({})}`,
      });
      expect(menuEntry(tool, fullEnv)).not.toHaveProperty("disabled");
    },
  );

  it.each(RX_RESUME_TOOLS)(
    "rejects $id without its required flags, before doing any work",
    async (tool) => {
      const error = await tool.run([], runContext).catch((e: unknown) => e);

      expect(error).toMatchObject({
        message: expect.stringMatching(/ is required\n/),
      });
    },
  );
});

// ─── runCli ───────────────────────────────────────────────────────────────────

describe("runCli", () => {
  it("prints each tool's usage and fails without a terminal", async () => {
    const { deps, errors } = createCliHarness(
      [updateResumeTool],
      {},
      { isTTY: false },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(updateResumeTool.usage);
  });

  it("exits cleanly when Exit is picked", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { deps } = createCliHarness([tool], {
      [PICK_TOOL]: "Exit",
    });

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("prints the command and runs the tool with the answers", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { deps, output } = createCliHarness(
      [tool],
      {
        [PICK_TOOL]: updateResumeTool.title,
        [promptFor(updateResumeTool, "id")]: "resume-1",
        [promptFor(updateResumeTool, "resume")]: "resume/Resume.md",
        [RUN_IT]: true,
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

  it("quotes an answer the shell would split in the printed command", async () => {
    const { tool } = withRecordedRuns(generateResumeTool);
    const { deps, output } = createCliHarness(
      [tool],
      {
        [PICK_TOOL]: generateResumeTool.title,
        ...generateRequiredScript,
        [RUN_IT]: true,
      },
      { env: fullEnv },
    );

    await runCli(deps);

    expect(output).toContain(
      'bun run cli generate-rx-resume --resume resume/Resume.md --name "Jane Doe"',
    );
  });

  it("prints the error and fails when the tool throws", async () => {
    // Without .env the tool stops at its config check, before any request.
    const { deps, errors } = createCliHarness(
      [deleteCoverLetterTool],
      {},
      { argv: ["delete-cover-letter", "--id", LETTER_ID] },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual([
      expect.stringContaining("Missing RXRESUME_API_KEY"),
    ]);
  });

  it("prints each cause under the error", async () => {
    const refused = new Error("Unable to connect.");
    const tool = withFailingRun(
      updateResumeTool,
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
      updateResumeTool,
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
    const { tool, calls } = withRecordedRuns(updateResumeTool);
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
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { deps, errors } = createCliHarness([tool], {}, { argv: ["nope"] });

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain('Unknown tool "nope"');
    expect(errors.join("\n")).toContain(tool.usage);
    expect(calls).toEqual([]);
  });

  it("prints Cancelled and exits 130 on Ctrl+C", async () => {
    const cancel = async (): Promise<never> => {
      throw new PromptCancelled();
    };
    const { deps, errors } = createCliHarness(
      [updateResumeTool],
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
    expect(errors).toEqual(["Cancelled."]);
  });
});
