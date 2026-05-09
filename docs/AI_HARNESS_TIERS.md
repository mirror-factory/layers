# AI Harness Tiers

This repo has a large AI starter-kit harness: registries, Playwright, Expect,
Vitest, evals, dependency audit, cost checks, design drift, evidence export, and
the `/dev-kit` dashboard. The harness is useful only if every actor knows which
level to run.

The rule is simple: cheap checks run constantly, expensive proof runs when the
workflow asks for it.

## Tier 0: Local Syntax And Structure

Purpose: catch cheap mistakes before a commit.

Command:

```bash
pnpm verify:tier 0
```

Runs:

- `pnpm typecheck`
- registry string validation
- vendor deprecation validation

Used by:

- `.husky/pre-commit`
- Symphony before it starts a ticket
- humans after config or type-heavy edits

Blocks:

- local commits
- Symphony continuing from a red baseline

## Tier 1: Fast Deterministic Tests

Purpose: give agents and humans a fast oracle without browsers or live AI
browser proof.

Command:

```bash
pnpm verify:tier 1
```

Runs:

- `pnpm test:fast`
- manifest drift check
- compliance check
- budget check

Used by:

- `.husky/pre-push`
- PR CI
- Symphony after implementation turns

Blocks:

- pushes
- PR CI
- Symphony PR creation

## Tier 2: Focused Ticket Proof

Purpose: prove the changed flow before review.

Command:

```bash
pnpm verify:tier 2
# or directly:
pnpm test:ticket
```

The ticket verifier looks at changed files and selects focused proof:

| Touched files | Added proof |
| --- | --- |
| `app/api/**` | route contracts |
| AI/tool files | eval stubs |
| `components/**` | matching component visual spec when present |
| app pages/layout/nav | smoke proof and mobile proof |

Used by:

- PR CI
- Symphony before moving a ticket to review
- dashboard "run proof" actions

Blocks:

- moving work to review
- merge into `development`

## Tier 3: Visual, Mobile, Usability, And Staging

Purpose: catch expensive UI regressions at the right time.

Command:

```bash
pnpm verify:tier 3
```

Runs:

- mobile visual matrix
- desktop visual matrix
- mobile flows
- design drift

Expect is not part of the default inner loop. Use it for focused usability
proof on changed routes or manually requested audits.

Used by:

- staging deploy checks
- manual broad UI proof
- daily scheduled visual runs

Blocks:

- staging promotion when explicitly run for release

## Tier 4: Background Regression And Drift

Purpose: keep the system healthy without slowing feature work.

Command:

```bash
pnpm verify:tier 4
```

Runs:

- dependency checks
- evals
- live integration checks
- strict doctor
- docs lookup coverage

Used by:

- nightly workflows
- weekly audits
- release-readiness sweeps

Blocks:

- releases only for high-severity dependency, security, cost, or eval drift

## Tier 5: Release And Native Artifact Proof

Purpose: prove public releases and downloadable artifacts.

Command:

```bash
pnpm verify:tier 5
```

Runs:

- app build
- Electron build
- download route smoke proof

Used by:

- release tags
- app-store promotion
- production launch checks

Blocks:

- public release announcement
- production promotion

## Evidence

Every tier writes JSON evidence under `.evidence/`.

Useful commands:

```bash
pnpm test:proof
pnpm evidence:export
```

`pnpm test:proof` gathers the latest `.evidence/` and `test-results/` files
into `.evidence/proof-packet.json`. Symphony and `/dev-kit` should link this
packet from each ticket and PR.

## Symphony Contract

Symphony should use the same commands humans use:

- before pickup: `pnpm verify:tier 0`
- after implementation: `pnpm verify:tier 1`
- before review: `pnpm verify:tier 2 && pnpm test:proof`
- for UI/staging tickets: `pnpm verify:tier 3`
- for release tickets: `pnpm verify:tier 5`

If a tier fails, Symphony should pause the ticket, attach the evidence file,
and avoid spending more tokens until the failure is understood.
