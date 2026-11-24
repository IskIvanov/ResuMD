import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { resolve } from "node:path";
import {
  CoverLetterTemplate,
  EnvironmentVariable,
} from "../rx-resume/api/types.ts";
import {
  connectRxResumeTool,
  deleteCoverLetterTool,
  deleteResumeTool,
  createCoverLetterTool,
  createResumeTool,
  RX_RESUME_TOOLS,
  updateCoverLetterTool,
  updateResumeTool,
} from "../rx-resume/index.ts";
import { exampleResumeTool, RESUME_MD_TOOLS } from "../resume-md/index.ts";
import type { EnvironmentVariables } from "../utils/types.ts";
import { promptOptions } from "./prompt.ts";
import {
  buildMenu,
  buildPlatformMenu,
  PromptCancelled,
  runCli,
} from "./run-cli.ts";
import {
  type CliDependencies,
  type Choice,
  ExitCode,
  MenuAction,
  type MenuValue,
  type PathLookup,
  type Prompter,
  type ToolDependencies,
  type ToolDefinition,
} from "./types.ts";

// ─── Paths and settings ───────────────────────────────────────────────────────

const WORKING_DIRECTORY = "/work/resume-tools";

/** A file system holding only resume/Resume.md and cv.md, under WORKING_DIRECTORY. */
const pathLookup: PathLookup = {
  workingDirectory: WORKING_DIRECTORY,
  exists: (absolutePath) =>
    ["resume/Resume.md", "cv.md"].some(
      (file) => resolve(WORKING_DIRECTORY, file) === absolutePath,
    ),
};

/** Where Connect saves the settings that every run reads. */
const SETTINGS_FILE = "/home/jane/.config/resume-tools/.env";

/** The settings file after connecting Reactive Resume. */
const SAVED_SETTINGS = [
  "RXRESUME_API_KEY=saved-key",
  "RXRESUME_API_URL=https://rx.example/api/openapi",
  "RXRESUME_APP_URL=https://rx.example",
  "",
].join("\n");

/** Fails the test that reaches it: CLI tests never touch files or the API. */
function unreachable(): never {
  throw new Error("A CLI test reached the outside world");
}

/** Runs a tool from WORKING_DIRECTORY with no settings, so an API tool fails before a request. */
const toolDependencies: ToolDependencies = {
  workingDirectory: WORKING_DIRECTORY,
  environmentVariables: {},
  fetch: unreachable,
  newId: unreachable,
  today: unreachable,
  now: unreachable,
  readFile: unreachable,
  exists: unreachable,
  writeFile: unreachable,
  settingsFile: SETTINGS_FILE,
  writePrivateFile: unreachable,
  log: unreachable,
  logError: unreachable,
};

/** Every setting any registered tool needs, so every preflight passes. */
const allSettings: EnvironmentVariables = {
  [EnvironmentVariable.ApiKey]: "key",
  [EnvironmentVariable.ApiUrl]: "https://rx.example/api/openapi",
  [EnvironmentVariable.AppUrl]: "https://rx.example",
};

// ─── Prompter ─────────────────────────────────────────────────────────────────

/** The CLI's own prompts, as the user sees them. */
const PICK_ACTION = "Select a platform from the list?";
const PICK_RX_RESUME_TOOL = "Which Reactive Resume tool?";
const OPTIONAL_FLAGS = "Set any optional flags?";
const RUN_IT = "Run it?";

/** Answers to a question asked more than once, one each time, in order. */
interface AnswersInTurn {
  inTurn: readonly string[];
}

/**
 * Answers keyed by question: select/input take text, checkbox a list, confirm
 * a boolean, and a select asked again takes its answers in turn.
 */
type PromptScript = Readonly<
  Record<string, string | readonly string[] | boolean | AnswersInTurn>
>;

/** One answer as a prompt receives it. */
type ScriptedAnswer = string | readonly string[] | boolean;

/**
 * A Prompter that answers from a script keyed by question.
 *
 * - select picks the first enabled choice whose name starts with the answer
 * - input and password run the prompt's validator and throw if the answer
 *   is rejected
 * - checkbox picks the choices whose value is in the answer list
 * - answers given in turn are used one per time the question is asked
 * - any prompt missing from the script, or asked once too often, throws
 */
function createFakePrompter(script: PromptScript): Prompter {
  const timesAsked: Record<string, number> = {};
  const answer = (question: string): ScriptedAnswer => {
    if (!(question in script))
      throw new Error(`Unscripted prompt: ${question}`);
    const scripted = script[question];
    if (typeof scripted !== "object" || !("inTurn" in scripted)) {
      return scripted;
    }
    const turn = timesAsked[question] ?? 0;
    timesAsked[question] = turn + 1;
    const inTurn = scripted.inTurn[turn];
    if (inTurn === undefined)
      throw new Error(`Asked once too often: ${question}`);
    return inTurn;
  };

  return {
    async select({ question, choices }) {
      const text = String(answer(question));
      const choice = choices.find(
        (candidate) => candidate.name.startsWith(text) && !candidate.disabled,
      );
      if (!choice)
        throw new Error(`No enabled choice "${text}" in ${question}`);
      return choice.value;
    },
    async input({ question, validate }) {
      const text = String(answer(question));
      const verdict = validate ? validate(text) : true;
      if (verdict !== true) throw new Error(`Rejected "${text}": ${verdict}`);
      return text;
    },
    async password({ question, validate }) {
      const text = String(answer(question));
      const verdict = validate ? validate(text) : true;
      if (verdict !== true) throw new Error(`Rejected "${text}": ${verdict}`);
      return text;
    },
    async checkbox({ question, choices }) {
      const scriptedAnswer = answer(question);
      const values = Array.isArray(scriptedAnswer) ? scriptedAnswer : [];
      return choices
        .filter((choice) => values.includes(String(choice.value)))
        .map((choice) => choice.value);
    },
    async confirm({ question }) {
      return answer(question) === true;
    },
  };
}

/** The question one of a tool'"'"'s options asks, so a script answers the tool'"'"'s real prompts. */
function promptFor(tool: ToolDefinition, flag: string): string {
  const option = tool.options.find((candidate) => candidate.flag === flag);
  if (!option) throw new Error(`${tool.id} has no --${flag}`);
  return option.question;
}

/** Fills create-resume'"'"'s required options and ticks nothing optional. */
const createRequiredScript: PromptScript = {
  [promptFor(createResumeTool, "resume")]: "resume/Resume.md",
  [promptFor(createResumeTool, "name")]: "Jane Doe",
  [OPTIONAL_FLAGS]: [],
};

/** A cover-letter id as Reactive Resume gives it: a UUID. */
const LETTER_ID = "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c";

/** create-cover-letter'"'"'s required flags; the letter needn't exist to parse. */
const CREATE_LETTER_ARGUMENTS: readonly string[] = [
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
 * Records each run's tool arguments, and the settings it ran with.
 */
function withRecordedRuns(tool: ToolDefinition): {
  tool: ToolDefinition;
  calls: string[][];
  settingsReceived: EnvironmentVariables[];
} {
  const calls: string[][] = [];
  const settingsReceived: EnvironmentVariables[] = [];
  return {
    tool: {
      ...tool,
      run: async (toolArguments, dependencies) => {
        calls.push([...toolArguments]);
        settingsReceived.push(dependencies.environmentVariables);
      },
    },
    calls,
    settingsReceived,
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

/**
 * The runCli dependencies for a settings file holding `savedText`, next to
 * the files pathLookup knows.
 */
function withSettingsFile(
  savedText: string,
): Pick<CliDependencies, "exists" | "readFile"> {
  return {
    exists: (absolutePath) =>
      absolutePath === SETTINGS_FILE || pathLookup.exists(absolutePath),
    readFile: (absolutePath) => {
      if (absolutePath === SETTINGS_FILE) return savedText;
      return unreachable();
    },
  };
}

/** Builds runCli dependencies that answer from a script and capture output. */
function createCliHarness(
  tools: readonly ToolDefinition[],
  script: PromptScript,
  overrides: Partial<CliDependencies> = {},
): { dependencies: CliDependencies; output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  const dependencies: CliDependencies = {
    ...toolDependencies,
    commandLineArguments: [],
    tools,
    prompter: createFakePrompter(script),
    isInteractiveTerminal: true,
    exists: pathLookup.exists,
    log: (line) => output.push(line),
    logError: (line) => errors.push(line),
    ...overrides,
  };
  return { dependencies, output, errors };
}

// ─── parse ────────────────────────────────────────────────────────────────────

describe("parse", () => {
  it("resolves paths from the working directory and fills defaults from earlier answers", () => {
    expect(
      createResumeTool.parse(
        ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
        WORKING_DIRECTORY,
      ),
    ).toEqual({
      resume: resolve(WORKING_DIRECTORY, "resume/Resume.md"),
      name: "Jane Doe",
      slug: "jane-doe",
      tags: [],
    });
  });

  it("keeps a given answer over its default and splits a list", () => {
    const values = createResumeTool.parse(
      [
        "--resume",
        "/abs/Resume.md",
        "--name",
        "Jane",
        "--slug",
        "jd",
        "--tags",
        "cv, design,",
      ],
      WORKING_DIRECTORY,
    );

    expect(values).toMatchObject({
      resume: "/abs/Resume.md",
      slug: "jd",
      tags: ["cv", "design"],
    });
  });

  it("throws with the usage when a required flag is missing", () => {
    const parseWithoutName = () =>
      createResumeTool.parse(["--resume", "resume.md"], WORKING_DIRECTORY);

    expect(parseWithoutName).toThrow(
      `--name <name> is required\n${createResumeTool.usage}`,
    );
  });

  it("throws on an unknown flag", () => {
    expect(() =>
      createResumeTool.parse(
        ["--resume", "resume.md", "--name", "Jane", "--nope", "x"],
        WORKING_DIRECTORY,
      ),
    ).toThrow();
  });

  it("parses a choice into one of its values, typed as their union", () => {
    const values = createCoverLetterTool.parse(
      [...CREATE_LETTER_ARGUMENTS, "--template", "onyx"],
      WORKING_DIRECTORY,
    );

    expect(values.template).toBe(CoverLetterTemplate.Onyx);
    expectTypeOf(values.template).toEqualTypeOf<
      CoverLetterTemplate | undefined
    >();
  });

  it("rejects a value that isn't one of the choices", () => {
    expect(() =>
      createCoverLetterTool.parse(
        [...CREATE_LETTER_ARGUMENTS, "--template", "charizard"],
        WORKING_DIRECTORY,
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
        WORKING_DIRECTORY,
      ),
    ).toThrow("--id: Field must accept a valid UUID");
  });

  it("runs the tool with the parsed values and its environment variables", async () => {
    // No settings stop the tool at its settings check, before any request.
    await expect(
      createCoverLetterTool.run(CREATE_LETTER_ARGUMENTS, toolDependencies),
    ).rejects.toThrow("Reactive Resume isn't connected");
  });
});

// ─── promptOptions ────────────────────────────────────────────────────────────

describe("promptOptions", () => {
  it("builds tool arguments from the required options only", async () => {
    const prompter = createFakePrompter(createRequiredScript);

    const toolArguments = await promptOptions(
      createResumeTool.options,
      prompter,
      pathLookup,
    );

    expect(toolArguments).toEqual([
      "--resume",
      "resume/Resume.md",
      "--name",
      "Jane Doe",
    ]);
  });

  it("shows each optional flag's default and prompts for a ticked one", async () => {
    const prompter = createFakePrompter({
      ...createRequiredScript,
      [OPTIONAL_FLAGS]: ["slug"],
      [promptFor(createResumeTool, "slug")]: "jane",
    });
    const checkbox = vi.spyOn(prompter, "checkbox");

    const toolArguments = await promptOptions(
      createResumeTool.options,
      prompter,
      pathLookup,
    );

    expect(checkbox).toHaveBeenCalledWith({
      question: OPTIONAL_FLAGS,
      choices: [
        { name: "--slug (default: jane-doe)", value: "slug" },
        { name: "--tags", value: "tags" },
      ],
    });
    expect(toolArguments).toEqual([
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
      [promptFor(createCoverLetterTool, "letter")]: "cv.md",
      [promptFor(createCoverLetterTool, "name")]: "Acme — Frontend",
      [promptFor(createCoverLetterTool, "resume-id")]: "resume-1",
      [OPTIONAL_FLAGS]: ["template"],
      [promptFor(createCoverLetterTool, "template")]: "onyx",
    });
    const select = vi.spyOn(prompter, "select");

    const toolArguments = await promptOptions(
      createCoverLetterTool.options,
      prompter,
      pathLookup,
    );

    expect(select).toHaveBeenCalledWith({
      question: promptFor(createCoverLetterTool, "template"),
      choices: Object.values(CoverLetterTemplate).map((template) => ({
        name: template,
        value: template,
      })),
    });
    expect(toolArguments).toEqual(
      expect.arrayContaining(["--template", "onyx"]),
    );
  });

  describe("checks a typed path", () => {
    /** Answers update-resume'"'"'s prompts, with `path` for --resume. */
    function promptForResume(path: string): Promise<string[]> {
      const prompter = createFakePrompter({
        [promptFor(updateResumeTool, "id")]: "resume-1",
        [promptFor(updateResumeTool, "resume")]: path,
        [OPTIONAL_FLAGS]: [],
      });
      return promptOptions(updateResumeTool.options, prompter, pathLookup);
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

  it("asks for a secret option with its answer hidden", async () => {
    const question = promptFor(connectRxResumeTool, "api-key");
    const prompter = createFakePrompter({
      [question]: "rr_secret",
      [OPTIONAL_FLAGS]: [],
    });
    const password = vi.spyOn(prompter, "password");

    await promptOptions(connectRxResumeTool.options, prompter, pathLookup);

    expect(password).toHaveBeenCalledWith(
      expect.objectContaining({ question }),
    );
  });

  it("rejects a required answer left blank", async () => {
    const prompter = createFakePrompter({
      [promptFor(updateResumeTool, "id")]: "  ",
      [promptFor(updateResumeTool, "resume")]: "resume/Resume.md",
    });

    await expect(
      promptOptions(updateResumeTool.options, prompter, pathLookup),
    ).rejects.toThrow('Rejected "  ": A value is required');
  });

  it("accepts an id that is a UUID", async () => {
    const id = LETTER_ID;
    const prompter = createFakePrompter({
      [promptFor(updateCoverLetterTool, "id")]: id,
      [promptFor(updateCoverLetterTool, "letter")]: "cv.md",
      [OPTIONAL_FLAGS]: [],
    });

    const toolArguments = await promptOptions(
      updateCoverLetterTool.options,
      prompter,
      pathLookup,
    );

    expect(toolArguments).toEqual(expect.arrayContaining(["--id", id]));
  });
});

// ─── RX_RESUME_TOOLS ─────────────────────────────────────────────────────────

/** Every tool's usage line, as `bun run cli` prints it, keyed by tool id. */
const USAGE_BY_TOOL_ID: Readonly<Record<string, string>> = {
  "connect-rx-resume":
    "Usage: bun run cli connect-rx-resume --api-key <api-key> [--address <address>]",
  "create-resume":
    "Usage: bun run cli create-resume --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]",
  "update-resume":
    "Usage: bun run cli update-resume --id <id> --resume <path> [--dry-run <dry-run>]",
  "delete-resume": "Usage: bun run cli delete-resume --id <id>",
  "download-resume":
    "Usage: bun run cli download-resume --id <id> --format <format> [--output <path>]",
  "create-cover-letter":
    "Usage: bun run cli create-cover-letter --letter <path> --name <name> --resume-id <resume-id> [--application-id <application-id>] [--company <company>] [--template <template>]",
  "update-cover-letter":
    "Usage: bun run cli update-cover-letter --id <id> --letter <path> [--name <name>] [--company <company>] [--resume-id <resume-id>] [--application-id <application-id>] [--template <template>]",
  "delete-cover-letter": "Usage: bun run cli delete-cover-letter --id <id>",
};

/** A menu entry as one line: its tool's id, its platform, or its action. */
function menuLine(entry: Choice<MenuValue>): string {
  if (typeof entry.value === "string") return entry.value;
  if ("id" in entry.value) return entry.value.id;
  return entry.value.platform;
}

/** A Reactive Resume tool's own entry in that platform's menu. */
function menuEntry(
  tool: ToolDefinition,
  environmentVariables: EnvironmentVariables,
): Choice<MenuValue> {
  return buildPlatformMenu("Reactive Resume", [tool], environmentVariables)[0];
}

describe("RX_RESUME_TOOLS", () => {
  it("lists Connect, then every tool in menu order, then Back and Exit", () => {
    expect(
      buildPlatformMenu("Reactive Resume", RX_RESUME_TOOLS, allSettings).map(
        menuLine,
      ),
    ).toEqual([
      "connect-rx-resume",
      "create-resume",
      "update-resume",
      "delete-resume",
      "download-resume",
      "create-cover-letter",
      "update-cover-letter",
      "delete-cover-letter",
      MenuAction.Back,
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

  it.each(RX_RESUME_TOOLS.filter((tool) => tool !== connectRxResumeTool))(
    "disables $id with the reason until Reactive Resume is connected",
    (tool) => {
      expect(menuEntry(tool, {})).toMatchObject({
        disabled: `Not available: ${tool.preflight?.({})}`,
      });
      expect(menuEntry(tool, allSettings)).not.toHaveProperty("disabled");
    },
  );

  it("keeps Connect available before connecting", () => {
    expect(menuEntry(connectRxResumeTool, {})).not.toHaveProperty("disabled");
  });

  it.each(RX_RESUME_TOOLS)(
    "rejects $id without its required flags, before doing any work",
    async (tool) => {
      const error = await tool
        .run([], toolDependencies)
        .catch((error: unknown) => error);

      expect(error).toMatchObject({
        message: expect.stringMatching(/ is required\n/),
      });
    },
  );
});

// ─── The menu ─────────────────────────────────────────────────────────────────

/** Every registered tool, as src/cli/index.ts lists them. */
const ALL_TOOLS: readonly ToolDefinition[] = [
  ...RX_RESUME_TOOLS,
  ...RESUME_MD_TOOLS,
];

describe("buildMenu", () => {
  it("lists each platform, then the tools that need none, then Exit", () => {
    expect(buildMenu(ALL_TOOLS, {}).map(menuLine)).toEqual([
      "Reactive Resume",
      "example-resume",
      MenuAction.Exit,
    ]);
  });
});

// ─── runCli ───────────────────────────────────────────────────────────────────

describe("runCli", () => {
  it("prints each tool's usage and fails without a terminal", async () => {
    const { dependencies, errors } = createCliHarness(
      [updateResumeTool],
      {},
      { isInteractiveTerminal: false },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(updateResumeTool.usage);
  });

  it("exits cleanly when Exit is picked", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { dependencies } = createCliHarness([tool], {
      [PICK_ACTION]: "Exit",
    });

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("goes back to the first level from a platform's tools", async () => {
    const { tool, calls } = withRecordedRuns(exampleResumeTool);
    const { dependencies } = createCliHarness([...RX_RESUME_TOOLS, tool], {
      [PICK_ACTION]: { inTurn: ["Reactive Resume", exampleResumeTool.title] },
      [PICK_RX_RESUME_TOOL]: "Back",
      [OPTIONAL_FLAGS]: [],
      [RUN_IT]: true,
    });

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(calls).toEqual([[]]);
  });

  it("exits cleanly when Exit is picked in a platform's tools", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { dependencies } = createCliHarness([tool], {
      [PICK_ACTION]: "Reactive Resume",
      [PICK_RX_RESUME_TOOL]: "Exit",
    });

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("runs a tool that needs no platform straight from the first level", async () => {
    const { tool, calls } = withRecordedRuns(exampleResumeTool);
    const { dependencies, output } = createCliHarness([tool], {
      [PICK_ACTION]: exampleResumeTool.title,
      [OPTIONAL_FLAGS]: [],
      [RUN_IT]: true,
    });

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(output).toContain("bun run cli example-resume");
    expect(calls).toEqual([[]]);
  });

  it("reads the saved settings, so a connected platform's tools are available", async () => {
    const { tool, calls } = withRecordedRuns(deleteResumeTool);
    const { dependencies } = createCliHarness(
      [tool],
      {
        [PICK_ACTION]: "Reactive Resume",
        [PICK_RX_RESUME_TOOL]: deleteResumeTool.title,
        [promptFor(deleteResumeTool, "id")]: "resume-1",
        [RUN_IT]: true,
      },
      withSettingsFile(SAVED_SETTINGS),
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(calls).toEqual([["--id", "resume-1"]]);
  });

  describe("with saved settings", () => {
    /** Runs delete-resume directly and returns the API key its run received. */
    async function apiKeyReceived(
      environmentVariables: EnvironmentVariables,
    ): Promise<string | undefined> {
      const { tool, settingsReceived } = withRecordedRuns(deleteResumeTool);
      const { dependencies } = createCliHarness(
        [tool],
        {},
        {
          commandLineArguments: ["delete-resume", "--id", "resume-1"],
          environmentVariables,
          ...withSettingsFile(SAVED_SETTINGS),
        },
      );

      await runCli(dependencies);
      return settingsReceived[0]?.[EnvironmentVariable.ApiKey];
    }

    it("lets a shell or .env value override a saved one", async () => {
      expect(await apiKeyReceived({ RXRESUME_API_KEY: "shell-key" })).toBe(
        "shell-key",
      );
    });

    it("keeps a saved value over an empty one", async () => {
      expect(await apiKeyReceived({ RXRESUME_API_KEY: "" })).toBe("saved-key");
    });
  });

  it("prints the command and runs the tool with the answers", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { dependencies, output } = createCliHarness(
      [tool],
      {
        [PICK_ACTION]: "Reactive Resume",
        [PICK_RX_RESUME_TOOL]: updateResumeTool.title,
        [promptFor(updateResumeTool, "id")]: "resume-1",
        [promptFor(updateResumeTool, "resume")]: "resume/Resume.md",
        [OPTIONAL_FLAGS]: [],
        [RUN_IT]: true,
      },
      { environmentVariables: allSettings },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(output).toContain(
      "bun run cli update-resume --id resume-1 --resume resume/Resume.md",
    );
    expect(calls).toEqual([
      ["--id", "resume-1", "--resume", "resume/Resume.md"],
    ]);
  });

  it("hides a secret answer in the printed command, and runs the tool with it", async () => {
    const { tool, calls } = withRecordedRuns(connectRxResumeTool);
    const { dependencies, output } = createCliHarness([tool], {
      [PICK_ACTION]: "Reactive Resume",
      [PICK_RX_RESUME_TOOL]: connectRxResumeTool.title,
      [promptFor(connectRxResumeTool, "api-key")]: "rr_secret",
      [OPTIONAL_FLAGS]: [],
      [RUN_IT]: true,
    });

    await runCli(dependencies);

    expect(output).toEqual([
      "bun run cli connect-rx-resume --api-key ••••••••",
    ]);
    expect(calls).toEqual([["--api-key", "rr_secret"]]);
  });

  it("quotes an answer the shell would split in the printed command", async () => {
    const { tool } = withRecordedRuns(createResumeTool);
    const { dependencies, output } = createCliHarness(
      [tool],
      {
        [PICK_ACTION]: "Reactive Resume",
        [PICK_RX_RESUME_TOOL]: createResumeTool.title,
        ...createRequiredScript,
        [RUN_IT]: true,
      },
      { environmentVariables: allSettings },
    );

    await runCli(dependencies);

    expect(output).toContain(
      'bun run cli create-resume --resume resume/Resume.md --name "Jane Doe"',
    );
  });

  it("prints the error and fails when the tool throws", async () => {
    // Not connected, the tool stops at its settings check, before any request.
    const { dependencies, errors } = createCliHarness(
      [deleteCoverLetterTool],
      {},
      { commandLineArguments: ["delete-cover-letter", "--id", LETTER_ID] },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Failure);
    expect(errors).toEqual([
      expect.stringContaining("Reactive Resume isn't connected"),
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
    const { dependencies, errors } = createCliHarness(
      [tool],
      {},
      { commandLineArguments: ["update-resume"] },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Failure);
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
    const { dependencies, errors } = createCliHarness(
      [tool],
      {},
      { commandLineArguments: ["update-resume"] },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Failure);
    expect(errors).toEqual(["POST failed: Unable to connect."]);
  });

  it("runs the tool named by the first argument, without the menu", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const flags = ["--id", "resume-1", "--resume", "resume/Resume.md"];
    const { dependencies } = createCliHarness(
      [tool],
      {},
      {
        commandLineArguments: ["update-resume", ...flags],
        isInteractiveTerminal: false,
      },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Success);
    expect(calls).toEqual([flags]);
  });

  it("lists every tool's usage and fails for an unknown tool", async () => {
    const { tool, calls } = withRecordedRuns(updateResumeTool);
    const { dependencies, errors } = createCliHarness(
      [tool],
      {},
      { commandLineArguments: ["nope"] },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain('Unknown tool "nope"');
    expect(errors.join("\n")).toContain(tool.usage);
    expect(calls).toEqual([]);
  });

  it("prints Cancelled and exits 130 on Ctrl+C", async () => {
    const cancel = async (): Promise<never> => {
      throw new PromptCancelled();
    };
    const { dependencies, errors } = createCliHarness(
      [updateResumeTool],
      {},
      {
        prompter: {
          select: cancel,
          input: cancel,
          password: cancel,
          checkbox: cancel,
          confirm: cancel,
        },
      },
    );

    expect(await runCli(dependencies)).toBe(ExitCode.Cancelled);
    expect(errors).toEqual(["Cancelled."]);
  });
});
