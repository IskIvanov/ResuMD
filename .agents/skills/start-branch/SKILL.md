---
name: start-branch
description: Creates a working branch off main before the first change of a session, named after the Linear issue the request is about (looked up with the Linear MCP) or, when there is none, after a short summary of the request. Use whenever the current branch is main and a request will change files, and when the user asks to start work, pick up a Linear issue (such as BAC-77 or a linear.app link) or create a branch.
---

# start-branch

Nothing is changed on `main`. The first change of a session (an edit, a new
file, a command that writes to the repo) happens on a branch this skill
creates.

## Workflow

1. **Check the branch.** Run `git branch --show-current`. Anything but `main`
   means the work is already on a branch: stop here and stay on it.
2. **Check that the request changes something.** A question, an explanation or
   a review needs no branch. Create one as soon as the work turns into a change.
3. **Find the Linear issue.** The Linear tools are deferred: load them with
   ToolSearch `select:mcp__claude_ai_Linear__get_issue,mcp__claude_ai_Linear__list_issues`.
   - The request names an issue (`BAC-77`, `bac-77`, a
     `linear.app/.../issue/BAC-77/...` link, or the issue's branch name): call
     `get_issue` with that identifier and `fields: ["title", "status",
     "gitBranchName"]`.
   - It names none: make one `list_issues` call with `assignee: "me"`, a
     `query` of one or two distinctive words from the request, and the same
     `fields`. Skip issues that are Done or Canceled. Take an issue only when
     its title describes the same work. With two candidates, or any doubt,
     take none.
   - The Linear tools are missing or fail: go on without an issue and say so.
4. **Name the branch.**
   - From an issue: its `gitBranchName`, exactly as Linear returns it, such
     as `bac-77-add-a-license-before-making-resume-tools-public`. It carries
     the issue's identifier, which is what Linear's GitHub integration uses to
     link the pull request to the issue.
   - From the request: `<type>-<summary>`. `type` is the Conventional Commits
     type of the change (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`).
     `summary` is two to five lowercase words, joined with hyphens, naming
     what the request asks for, with no filler (`a`, `the`, `please`,
     `update`). The whole name stays under 50 characters, using only `a-z`,
     `0-9` and `-`.
5. **Create it.**
   - Clean working tree: `git pull --ff-only` first, so the branch starts from
     the latest `main`. If the pull fails (offline, diverged), go on from the
     local `main` and say so.
   - `git switch -c <name>`. Uncommitted changes come along, which is what we
     want.
   - The issue's branch already exists, locally or as `origin/<name>`:
     `git switch <name>` to resume that work instead.
   - A summary name is already taken: that branch holds other work, so pick
     a more specific summary.
6. **Say what happened**, in one line, then carry on with the request:
   - `Branched off main: bac-77-add-a-license-before-making-resume-tools-public (Linear BAC-77)`
   - `Branched off main: feat-cover-letter-locale-option (no Linear issue matched)`

This skill only creates the branch. Committing, pushing, opening a pull
request and moving the Linear issue wait until the user asks for them.

## Summary names

| Request                                                        | Branch                              |
| -------------------------------------------------------------- | ----------------------------------- |
| "add a `--locale` option to `create-cover-letter`"             | `feat-cover-letter-locale-option`   |
| "update-resume drops hidden items, fix it"                     | `fix-update-resume-hidden-items`    |
| "write a contributing guide"                                   | `docs-contributing-guide`           |
| "move the API types into their own file"                       | `refactor-api-types-file`           |
| "add a skill that writes commit messages"                      | `chore-agent-commit-skill`          |
