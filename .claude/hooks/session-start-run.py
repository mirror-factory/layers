#!/usr/bin/env python3
"""
session-start-run -- generate a run_id for every Claude Code session.

Runs at SessionStart. Writes `.ai-dev-kit/state/current-run.json` with:
  - run_id (ULID-like, sortable)
  - branch (from git)
  - feature_name (parsed from branch: feat/<name>, fix/<name>, etc.)
  - started_at (ISO8601)
  - spec_path (features/<name>/SPEC.md if present)

Every subsequent log record, test run, vendor call, eval run, and notify
event in this session inherits the same run_id. The dashboard at
/dev-kit/runs/[run_id] aggregates everything by that key.

Idempotent: if a run is already active AND the branch matches, we keep the
existing run_id. This means a user can reopen a Claude Code session mid-
feature and resume the same run. If the branch changed, we start a new
run (previous one moves to history automatically via its ended_at timestamp
from the next endRun call).

Silent on any error. A broken session-start hook must not block Claude Code.
"""
import json
import os
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


STATE_DIR = Path(".ai-dev-kit/state")
CURRENT_FILE = STATE_DIR / "current-run.json"
HISTORY_DIR = STATE_DIR / "runs" / "history"

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def generate_run_id() -> str:
    """ULID-ish run id. Sortable by time."""
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    ts_part = ""
    v = ts
    for _ in range(10):
        ts_part = CROCKFORD[v % 32] + ts_part
        v //= 32
    rand_part = "".join(random.choice(CROCKFORD) for _ in range(16))
    return f"run_{ts_part}{rand_part}"


def git_branch() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=3,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return None


def feature_name_from_branch(branch: str | None) -> str | None:
    if not branch:
        return None
    # Parse feat/brand-studio, fix/husky-compliance, claude/<slug>, etc.
    for prefix in ("feat/", "feature/", "fix/", "hotfix/", "chore/", "claude/"):
        if branch.startswith(prefix):
            return branch[len(prefix):]
    return branch


def resolve_spec_path(feature: str | None) -> str | None:
    if not feature:
        return None
    candidate = Path("features") / feature / "SPEC.md"
    return str(candidate) if candidate.exists() else None


def load_current() -> dict | None:
    if not CURRENT_FILE.exists():
        return None
    try:
        return json.loads(CURRENT_FILE.read_text())
    except Exception:
        return None


def main() -> int:
    try:
        # stdin carries Claude Code's SessionStart event JSON; we don't
        # strictly need it but we read it to stay compatible with the hook
        # contract (future: use session_id from payload as parent_run_id for
        # sub-agent spawning).
        try:
            sys.stdin.read()
        except Exception:
            pass

        branch = git_branch()
        feature = feature_name_from_branch(branch)
        spec = resolve_spec_path(feature)

        # Resume behavior: if there's already a current run on the same branch
        # and it hasn't ended, keep it. Prevents a run_id per reopen.
        current = load_current()
        if current and current.get("branch") == branch and not current.get("ended_at"):
            return 0

        run_id = generate_run_id()
        ctx = {
            "run_id": run_id,
            "feature_name": feature,
            "branch": branch,
            "task": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "parent_run_id": None,
            "spec_path": spec,
        }

        STATE_DIR.mkdir(parents=True, exist_ok=True)
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        CURRENT_FILE.write_text(json.dumps(ctx, indent=2))
        (HISTORY_DIR / f"{run_id}.json").write_text(json.dumps(ctx, indent=2))

        # One-line context message to Claude Code's additionalContext field.
        # This is how the agent gets the run_id injected into its context.
        additional_context = (
            f"run_id: {run_id} | branch: {branch or 'unknown'} | "
            f"feature: {feature or 'none'} | dashboard: /dev-kit/runs/{run_id}"
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": additional_context,
            }
        }))
        return 0
    except Exception as e:
        # Never block Claude Code on a hook failure.
        print(f"[session-start-run] soft-failed: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main())
