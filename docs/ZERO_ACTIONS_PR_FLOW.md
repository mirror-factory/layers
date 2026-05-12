# Zero-Actions PR Flow

This repository currently has GitHub workflow files that can run on push or PR.
When GitHub-hosted Actions budget is zero, do not push a normal feature branch
and hope the platform stays quiet.

## Rule

Local proof is the source of truth until a self-hosted runner path exists.

GitHub `[skip ci]` markers prevent many `push` and `pull_request` workflows from
running, but skipped required checks can remain pending. That means skip-CI is a
cost-control tool, not a merge-proof tool.

## Required local proof packet

Before any no-Actions PR handoff:

```bash
pnpm verify:tier 0
pnpm verify:tier 1
pnpm verify:tier 2
pnpm test:done
pnpm test:proof
pnpm pr:zero-actions
```

For user-facing UI work, add:

```bash
EXPECT_RUN=1 EXPECT_REQUIRED=1 pnpm test:expect
pnpm verify:tier 3
pnpm test:done
pnpm test:proof
pnpm pr:zero-actions
```

For release/native work, add:

```bash
pnpm verify:tier 5
pnpm test:proof
pnpm pr:zero-actions
```

The final command writes:

- `.evidence/zero-actions-pr.json`
- `.evidence/zero-actions-pr-body.md`

## Safe PR strategy

1. Finish local proof.
2. Squash or recommit the final branch with a HEAD commit message containing
   `[skip ci]`.
3. Push only that prepared branch.
4. Open a draft PR using `.evidence/zero-actions-pr-body.md`.
5. Treat the local proof packet as the required evidence.

Do not merge based on skipped GitHub checks. Merge only when Symphony/dashboard
proof, local artifacts, or a self-hosted runner status says the required tiers
are green.

## Future self-hosted path

The future zero-hosted-minutes setup should:

- use explicit self-hosted runner labels for Linux/Android lanes
- keep macOS/iOS work on Alfonso's Mac runner when available
- run a runner health/version check before queueing jobs
- publish a status/check back to GitHub or Symphony from the local proof packet
- keep real model/eval work label-gated or scheduled, not default PR work
