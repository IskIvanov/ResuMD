# Working with an AI agent

The repo is set up for coding agents such as
[Claude Code](https://claude.com/claude-code). [AGENTS.md](../AGENTS.md) is the
agent's brief: the architecture, the conventions, and how to add a tool or a
platform. The skills in `.agents/skills/` give the agent one way to test,
commit and open a pull request, so its work arrives in the shape a review
expects. Start the agent from the repo's root so it picks up all three.

## Skills

| Skill                  | What it does                                                                                                  | Ask for it with                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `tdd`                  | Drives every code change test-first: agree what to test, then one failing test and the code that passes it.   | "add … test-first", `/tdd`            |
| `caveman-commit`       | Writes a Conventional Commits message, such as `feat(rx-resume): add download-resume tool`, that says why.    | "commit", `/caveman-commit`           |
| `write-pr-description` | Writes the pull request body: a summary, how it was checked, and a reading order when the diff needs one.     | "open a PR", `/write-pr-description`  |

Claude Code loads skills only from `.claude/skills/`, so each skill there is a
symlink into `.agents/skills/`. To add one, put it in `.agents/skills/<name>/`
and link it:

```bash
ln -s ../../.agents/skills/<name> .claude/skills/<name>
```

## Every change starts with a test

No logic goes in without a failing test first. A hook
(`.agents/hooks/tdd-gate.sh`, run from `.claude/settings.json`, needs `jq`)
stops the agent from editing any `*.test.ts` until it has loaded the `tdd`
skill. The skill then has the agent:

1. Propose the seams to test: public boundaries such as a tool run through its
   tool arguments, each with a note on what it catches and what it misses.
   You confirm them before any test is written.
2. Write one failing test at a confirmed seam and watch it fail.
3. Write only enough code to make it pass, and watch it pass.
4. Move to the next slice.

Tests use synthetic data (Jane Doe, Acme BV), never a real resume or letter.

## A session, start to finish

1. Branch off `main` and start the agent in the repo's root.
2. Describe the change in the project's words, for example "add a `--locale`
   option to `create-cover-letter`", and link the issue if there is one.
3. Review the seams the agent proposes: add the case you care about, drop any
   that test internals.
4. Let it work one slice at a time. It runs `bunx vitest run` and
   `bun run typecheck`; read each diff as it lands.
5. Say "commit" to get a message from `caveman-commit`. The skill only writes
   the message, so tell the agent to commit, and later to push, when you're
   happy with it.
6. Say "open a PR" to get a description from `write-pr-description`, and read
   it before you post it.

You stay the reviewer throughout: the agent proposes what to test and how to
describe the change, and you confirm both.
