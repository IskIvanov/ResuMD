#!/usr/bin/env bash
# Remind the agent to branch off main before it changes anything.
#
# UserPromptSubmit: when the repo is on `main`, adds a note to the prompt
# telling the agent to load the `start-branch` skill before its first change.
# On any other branch, or outside a git repo, it adds nothing.
set -euo pipefail

branch="$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null || true)"
if [[ "$branch" != "main" ]]; then
  exit 0
fi

jq -n '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: "The current branch is main. Before the first change to the repository, invoke the Skill tool with skill \"start-branch\" and create the branch it names. A request that changes nothing needs no branch."
  }
}'
