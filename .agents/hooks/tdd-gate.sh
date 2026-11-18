#!/usr/bin/env bash
# Gate test files behind the `tdd` skill.
#
# PostToolUse on Skill: loading `tdd` marks the session.
# PreToolUse on Write|Edit: writing a *.test.ts file in an unmarked session
# is denied with an instruction to load the skill first.
set -euo pipefail

input="$(cat)"
event="$(jq -r '.hook_event_name // empty' <<<"$input")"
session="$(jq -r '.session_id // "unknown"' <<<"$input")"
marker="${TMPDIR:-/tmp}/claude-tdd-skill-${session}"

case "$event" in
  PostToolUse)
    skill="$(jq -r '.tool_input.skill // empty' <<<"$input")"
    if [[ "$skill" == "tdd" ]]; then
      touch "$marker"
    fi
    ;;
  PreToolUse)
    file="$(jq -r '.tool_input.file_path // empty' <<<"$input")"
    if [[ "$file" != *.test.ts ]] || [[ -f "$marker" ]]; then
      exit 0
    fi
    jq -n --arg file "$file" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("Before writing tests (" + $file + "), invoke the Skill tool with skill \"tdd\" and follow it: confirm the seams under test with the user, then work one red -> green slice at a time. Retry this edit after the skill is loaded.")
      }
    }'
    ;;
esac
