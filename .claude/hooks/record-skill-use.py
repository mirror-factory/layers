#!/usr/bin/env python3
"""
record-skill-use -- track every Claude Code Skill invocation.

Runs as a PreToolUse hook matcher for the Skill tool. Appends one JSONL line
to `.ai-dev-kit/state/skill-invocations.jsonl` with:
  - ts (ISO8601)
  - run_id (from .ai-dev-kit/state/current-run.json)
  - skill (name arg from the Skill tool call)
  - args (optional args string)
  - session_id (Claude Code's session id)
  - transcript_path (for later correlation)

Vercel's AGENTS.md eval showed skills auto-invoke at 79% and never-invoke at
56%. This recorder makes that measurable per-project so the team can see
which skills are actually firing. `scripts/sync-registries.ts` aggregates
the JSONL into `.ai-dev-kit/registries/skills.yaml` with invocation_count +
last_invoked_at, which `onboard` surfaces in AGENTS.md Kit Catalog.

Silent on any error -- hooks must never break Claude Code.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


STATE_FILE = Path(".ai-dev-kit/state/current-run.json")
LOG_FILE = Path(".ai-dev-kit/state/skill-invocations.jsonl")


def load_run_id() -> str | None:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text()).get("run_id")
    except Exception:
        return None


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0

        payload = json.loads(raw)

        # Only record Skill tool invocations.
        tool_name = payload.get("tool_name") or payload.get("toolName")
        if tool_name != "Skill":
            return 0

        tool_input = payload.get("tool_input") or payload.get("toolInput") or {}
        skill = tool_input.get("skill")
        if not skill:
            return 0

        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": load_run_id(),
            "skill": skill,
            "args": tool_input.get("args"),
            "session_id": payload.get("session_id") or payload.get("sessionId"),
            "transcript_path": payload.get("transcript_path") or payload.get("transcriptPath"),
        }

        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a") as f:
            f.write(json.dumps(record) + "\n")

        return 0
    except Exception as e:
        print(f"[record-skill-use] soft-failed: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main())
