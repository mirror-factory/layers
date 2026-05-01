# Getting Started — humans, LLMs, and agents

This file is the entry point for **anyone** (or any agent) who joins this repo. Read it before opening a PR, before redesigning a page, before changing how we ship, and before landing AI work. If you only have time for one document, read this one — it links to everything else that's load-bearing.

> **Project:** Layers — a meeting recorder + AI memory + MCP server, shipped as web, macOS, Windows, iOS, and Android from a single Next.js codebase.
>
> **Org:** [Mirror Factory](https://mirrorfactory.ai) · Linear: [layers](https://linear.app/mirror-factory/project/layers-786bd350532f)

---

## 1. The non-negotiables

These four rules are stricter than any other instruction in this repo. Agents must obey them. Humans should too.

| Rule | Where it's enforced |
|--|--|
| **Never push directly to `main`.** Every change goes feature → development → staging → main. | [`docs/RELEASE.md`](./RELEASE.md) · GitHub branch protection · [PROD-383](https://linear.app/mirror-factory/issue/PROD-383) |
| **Match `DESIGN.md` exactly.** Paper Calm v1 — OKLCH tokens, 4pt grid, mint primary, `<LayersLogo>`. No raw hex. | [`DESIGN.md`](../DESIGN.md) · `.ai-starter/manifests/design.json` |
| **AI SDK v6 patterns or it breaks.** `inputSchema` not `parameters`. `toUIMessageStreamResponse()`. `message.parts[]`. | [`AGENTS.md`](../AGENTS.md) · [`CLAUDE.md`](../CLAUDE.md) |
| **Auth, billing, and recording wiring is sacred.** Don't refactor Supabase, Stripe, or AssemblyAI handlers without explicit scope from the PR description. | Inline in `app/(public)/sign-*/page.tsx`, `app/api/billing/**`, `app/api/transcribe/**` |

---

## 2. Map of the load-bearing docs

Read in this order if you're new. Skim if you're returning.

### Product + brand
- [`README.md`](../README.md) — high-level pitch, tech stack, dev quickstart.
- [`docs/GETTING_STARTED.md`](./GETTING_STARTED.md) — this file.
- [`DESIGN.md`](../DESIGN.md) — Paper Calm v1 design system. **Source of truth for visual decisions.**
- `.ai-starter/product-spec/latest.md` — current YC-style product spec.
- `.ai-starter/product-validation/latest.md` — customer/problem/MVP validation.

### How we ship
- [`docs/RELEASE.md`](./RELEASE.md) — three-tier flow (dev → staging → main), Vercel setup, GitHub branch protection, OAuth/webhook allow-lists, migration checklist.
- [`AGENTS.md`](../AGENTS.md) — the "if you're an agent, read this first" file (Vercel's eval shows this beats skill-based context). Cross-references release rules and design rules.
- [`CLAUDE.md`](../CLAUDE.md) — wraps `AGENTS.md` for Claude Code specifically, plus AI Starter Kit contract.
- `.ai-starter/manifests/*.json` — machine-readable registries (features, hooks, evidence, runtimes, design, integrations). Run `pnpm sync` after changes.

### When you're about to write code
- [`.impeccable.md`](../.impeccable.md) — design context for the `impeccable` skill. Required before UI work.
- `.ai-starter/research/libraries/*.md` — cached current docs for Vercel AI SDK, Next.js, Tailwind v4, Supabase, Vitest. Refresh with `pnpm research:refresh <id>` when stale.
- `docs/PRICING_AND_BILLING.md` — pricing tiers, Stripe wiring, env vars. The literal `$0 / $20 / $30` strings are enforced by `tests/pricing-consistency.test.ts`.
- `docs/RECORDING_RELIABILITY.md` — capture path failures and how the streaming/upload paths must behave.
- `docs/BUILD_SPEC.md` — original blueprint. Treat as historical context, not authoritative — current behaviour lives in code + manifests.

### Compliance + launch
- `docs/LAUNCH_CHECKLIST.md` — gates 1–6 + launch-day checklist.
- `docs/V1_PLAN.md` — sprint-by-sprint roadmap (M1 → M6 in Linear).
- `app/(public)/privacy/page.tsx` and `terms/page.tsx` and `account-deletion/page.tsx` — legal text. **Do not edit copy** without legal review.

### Agent-specific
- `.claude/skills/*/SKILL.md` — Claude Code skills (compliance-fix, observability-debug, product-validation, mfdr, visual-qa, wire-telemetry, context7-first, capacitor-best-practices, app-store-screenshot-capture).
- `.codex/config.toml` and `.codex/hooks.json` — Codex runtime configuration.
- `~/.claude/skills/impeccable/SKILL.md` — the impeccable design skill (user-global). Required before any UI build.

---

## 3. Day-zero setup (humans)

```bash
git clone https://github.com/mirror-factory/audio-layer.git
cd audio-layer
pnpm install
cp env.local.template .env.local            # fill in API keys
pnpm dev                                    # http://localhost:3000
```

Minimum env vars to boot something: `AI_GATEWAY_API_KEY`, `ASSEMBLYAI_API_KEY`. Persistence requires Supabase keys. Billing requires Stripe keys. Email requires Resend.

For **staging** or **dev**-tier creds locally: `pnpm dev:staging` / `pnpm dev:dev` (after `vercel env pull`). See [`docs/RELEASE.md`](./RELEASE.md#local-script-switch-tiers-safely).

---

## 4. Day-zero setup (agents)

Before writing or editing code, read in this order:

1. This file (`docs/GETTING_STARTED.md`).
2. [`AGENTS.md`](../AGENTS.md) — strict instructions, AI SDK patterns, release flow.
3. [`DESIGN.md`](../DESIGN.md) — if your task is UI. Match tokens exactly.
4. The relevant cached research under `.ai-starter/research/libraries/` if you're touching a fast-moving library.
5. Existing patterns in the codebase. Grep before inventing.

After writing code:

1. `pnpm typecheck` (must pass).
2. `pnpm test` for unit; `pnpm test:e2e` for browser proof when relevant.
3. `pnpm sync` to refresh manifests.
4. `pnpm score` to update the readiness scorecard.
5. Open a PR into **`development`** — never directly into `staging` or `main`.

If you're about to bypass any of the above, write down why in the PR description. If you're about to push direct to main, stop — see [`docs/RELEASE.md`](./RELEASE.md).

---

## 5. Where work is tracked

- **Linear:** [Layers project](https://linear.app/mirror-factory/project/layers-786bd350532f) under team **Product** (`PROD`). Six milestones M1–M6 mapped to `docs/V1_PLAN.md`.
- **Recent issues you should know about:**
  - [PROD-383](https://linear.app/mirror-factory/issue/PROD-383) — set up dev/staging/prod branches (this very flow)
  - [PROD-385](https://linear.app/mirror-factory/issue/PROD-385) — fix broken `hook-tests` gate
  - [PROD-384](https://linear.app/mirror-factory/issue/PROD-384) — public `/changelog` page
  - [PROD-378](https://linear.app/mirror-factory/issue/PROD-378) — Google OAuth typo (closed, kept here as a "this is why we have staging" example)

---

## 6. Quick links

- Production: <https://layers.mirrorfactory.ai>
- Staging (when wired): <https://staging.layers.mirrorfactory.ai>
- Dev (when wired): <https://dev.layers.mirrorfactory.ai>
- Repo: <https://github.com/mirror-factory/audio-layer>
- Linear: <https://linear.app/mirror-factory/project/layers-786bd350532f>
- Vercel project: `layers` under the `mirror-factory` team
- Support: <support@mirrorfactory.ai>

---

## Updating this file

This file is canonical. When you add a new load-bearing document (anything an agent should read before acting), add a line under §2 here. When the release flow changes, update §1 and §4. When a non-negotiable changes, update §1.

Last updated: 2026-05-01.
