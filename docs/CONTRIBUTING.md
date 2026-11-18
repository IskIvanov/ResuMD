# Contributing

Bug reports, fixes, docs and new platforms are welcome. For anything bigger
than a small fix, such as a new tool or platform, open an issue first so we can
agree on its shape before you build it.

## Reporting a bug

Say what you ran (the direct command the menu prints is enough), what you
expected and what happened. Reproduce it with the example resume
(`bun run cli example-resume`) or other made-up data, and never paste a real
resume, cover letter or API key. For an API problem, run the command again with
`RXRESUME_DEBUG=1` and include what it logs to stderr: each request's method,
URL, status and time, never the key.

## Making a change

1. Fork the repo and branch off `main`, one change per branch.
2. Read [AGENTS.md](../AGENTS.md) for the architecture and conventions, and the
   [glossary](GLOSSARY.md) for the terms the code uses. A new tool or platform
   follows its "Adding a tool" steps.
3. Write the test first: no logic goes in without a failing test. Tests sit
   next to the code as `foo.test.ts` and use made-up data (Jane Doe, Acme BV),
   never a real resume or letter.
4. Update the docs the change touches: the tool tables in the
   [README](../README.md#platforms), or the page in `docs/`. `.gitignore`
   blocks every other `*.md`, so a new page goes in `docs/`.
5. Check that everything passes:

   ```bash
   bun install
   bunx vitest run       # vitest, one pass (bun run test watches)
   bun run typecheck     # tsc --noEmit
   bun run format        # biome format --write .
   bun run format:check  # biome format .
   ```

   CI runs the same tests, typecheck and format check on every push to any
   branch and on every pull request (`.github/workflows/ci.yml`).

6. Commit with [Conventional Commits](https://www.conventionalcommits.org)
   messages that say why, such as `feat(rx-resume): add download-resume tool`,
   and open a pull request that says what changed and how you checked it.

Working with a coding agent? [Working with an AI agent](agentic-development.md)
sets one up to follow these steps through the repo's skills.

By contributing, you agree that your contributions are licensed under the
[MIT License](../LICENSE).
