# Linear Backlog Triage — 2026-05-11

**Scope:** All 27 open `Todo` issues assigned to `alfonso@mirrorfactory.com` on the Product team in the `mirror-factory` Linear workspace, pulled 2026-05-11.

**Source repo:** `layers` (this repo). Most recent build: `v0.1.71` (commit `2644820`), most recent merge `a446823` (PR #10 — iOS CI signing fix). Working tree is dirty — see "Pre-flight" below.

---

## TL;DR — the honest split

| Bucket | Count | What a loop can do |
|---|---:|---|
| A. Codeable in **this** repo | 4 | Loop end-to-end (red → green → refactor → PR) |
| B. Codeable but in a **different** repo/product | 9 | Loop, but only after we confirm the right repo |
| C. Docs / research / strategy | 7 | Loop drafts; you approve & polish |
| D. Human-only (meetings, contracts, signatures) | 4 | Out of scope |
| E. Recurring / cadence | 3 | Templates only |
| **Total** | **27** | |

Numbers add to 27. The single biggest takeaway: **at most ~13 of these are realistic Ralph-loop targets, and only ~4 of those live in this repo.** Anyone telling you a loop will close 27 tickets while you sleep is selling you something.

---

## Pre-flight — DO THESE BEFORE ANY LOOP

1. **Working tree is dirty.** A loop that lands a commit will sweep in pre-existing junk. Specifically:
   - Modified: `ios/App/App.xcodeproj/project.pbxproj`, `tsconfig.json`, `playwright-report/index.html`, `test-results/.last-run.json`, `.ai-starter/runs/*`
   - Untracked: `dist/`, `src/`, `src-tauri/`, `supabase/migrations/supabase/`, `tauri-dist/`, `components/ui/{card,separator,tabs}.tsx`, `generate-ios-icons.py`, `generate-tauri-icons.py`, `public/showcase.html`, `resources/`, `create-ios-icon.svg`, `ios-app-icon-1024.svg`, `docs/.vitepress/`, `.devkit/`
   - **Question for you:** is this in-flight work to keep, a side experiment to stash, or noise to discard? I won't guess.
2. **Branch hygiene.** Per `AGENTS.md` release flow, no direct pushes to `main`. Everything goes `feature/* → development → staging → main`. But **`development` and `staging` aren't wired up yet** (PROD-383, referenced in `docs/RELEASE.md`). So for now, feature branches with PRs to `main` is the only working path. Worth confirming before we push anything.
3. **Tag mismatch.** Latest commit bumps to `v0.1.71` but the tag list still shows `v0.1.70` as newest. Either the bump commit wasn't tagged, or `git fetch --tags` is stale.

---

## Bucket A — Codeable in **this** repo (4)

These are the realistic Ralph-loop targets for the `layers` repo right now.

| ID | Title | Pri | Why it fits | Loop-readiness |
|---|---|:-:|---|---|
| **PROD-304** | Set up Google Auth for Layers (current architecture) | High | Tight scope: Google OAuth via Supabase Auth on portal + main app, JWT refresh, session persistence. Has clear acceptance criteria already written. Supersedes PROD-85 for the 2026.1 architecture. | ✅ **Best first loop target.** |
| **PROD-305** | Verify credit system accuracy — Hustle ↔ Layers | **Urgent** | LiteLLM self-hosted credit layer. Verify per-user deduction, margin, no double-billing. Mixes investigation + small fixes. | ✅ Good 2nd loop — but needs access to running Hustle + Layers + LiteLLM to verify. Confirm env access before starting. |
| **PROD-302** | Review + update Layers white paper against shipped product | High | Documentation pass against `Layers 2026.1` (156 issues, 9 sprints shipped). Where is the current white paper file? Need that pointer first. | ⚠️ Loop can draft; you must verify positioning/voice. |
| **PROD-307** | Create skill set — branding, Vercel AI SDK, web design, MF environment patterns | Med | Authoring `.claude/skills/*.md` files in this repo's skill registry. Concrete artifact = SKILL.md files. | ✅ Codeable in this repo, but each skill is small — better as a batch with you reviewing each. |

---

## Bucket B — Codeable, but in a **different** repo/product (9)

These are real code, but they don't belong in the `layers` repo. Need to confirm target repo before any loop runs.

| ID | Title | Pri | Target repo (best guess) |
|---|---|:-:|---|
| PROD-303 | Moonshots & Magic — initial agentic demo (map + newsletter) | High | `moonshots-and-magic` repo (separate site) |
| PROD-293 | Moonshots & Magic MCP — public context server | High | `moonshots-and-magic` or new MCP repo |
| PROD-292 | Moonshots & Magic — accurate data sources + scrape log tracker | Med | `moonshots-and-magic` repo |
| PROD-291 | Moonshots & Magic — site refresh + data update | Med | `moonshots-and-magic` repo |
| PROD-295 | Blog animation system — animated diagram skill + WordPress | Med | WordPress backend + new skill |
| PROD-290 | Ideas Skill — capture, feasibility score, prototype path | Med | Skill (could live here or in `mf-master`) |
| PROD-101 | Discord Bot: Article Synopsis & Deep Dive | None | New repo |
| PROD-97 | MCP Package with Credentials for GitHub Sale | None | Likely new repo |
| PROD-116 | Mirror Factory: Landing Page, Demo, and Newsroom | None | `mirrorfactory.ai` repo (not this one) |

**Action:** For each, I need you to confirm the target repo before starting. None of these should land in `layers`.

---

## Bucket B′ — Hustle Together SDK refactor (5 tickets, same parent)

These all hang off **PROD-80** ("Transform Hustle Together SDK to CLI/registry system") and live in the `Layers / Hustle - Platform Foundation` project. They appear stale — labels say `sprint-Jan-24-Feb-6` (over 3 months old). Likely target repo: `hustle-together-sdk` (not `layers`).

| ID | Title | Status note |
|---|---|---|
| PROD-80 | Transform Hustle Together SDK to CLI/registry (parent) | Old sprint, no priority set |
| PROD-81 | Convert playground to CLI-based interface | Old sprint |
| PROD-82 | Set up registry for pullable skills | Old sprint |
| PROD-83 | Make system repeatable for easy creation | Old sprint |
| PROD-84 | Enable NL prompts → plan → scaffold flow | Old sprint, dueDate `2026-01-27` (4mo overdue) |

**Action:** Triage decision needed from you — are these still real? If yes, set priority + move to current cycle. If no, close them. **Do not Ralph-loop overdue, deprioritized issues.**

---

## Bucket C — Docs / research / strategy (7)

Loop can produce strong drafts. None should be auto-merged.

| ID | Title | Pri | Loop role |
|---|---|:-:|---|
| PROD-296 | Research: HyperTool MCP — dynamic toolset proxy | High | Drafts research summary in `.ai-starter/research/` |
| PROD-121 | Research Free Money Opportunities (35 grant programs) | High | Loop drafts applications; you sign |
| PROD-306 | Infrastructure cost + account registry | Med | Loop drafts table from configs + your inputs |
| PROD-297 | Doc Registry — Writing & Talks (The Port, Harness/Memory, Context/Vercel) | Med | Index doc; needs the actual writings attached |
| PROD-311 | SEO + motion video content strategy | Med | Strategy doc + content calendar; mostly your call |
| PROD-313 | mf-master — single Mirror Factory repo (dev+design+ops) | **Urgent** | Blocked on GitHub org repo creation (human). Once created, can scaffold structure. |
| PROD-302 | (already in Bucket A — listed there) |  |  |

---

## Bucket D — Human-only (4)

A loop cannot do these. Listed so you don't expect them in the queue.

| ID | Title | What it actually needs |
|---|---|---|
| PROD-319 | Internal meeting — Bobby (GitHub, MCP plugin, audio product, dev cycle) | Have the meeting. Take notes. |
| PROD-318 | ATP — SOW meeting + contract | Schedule, sign, send. |
| (PROD-313 above) | mf-master repo creation | You create the GitHub repo. |
| PROD-302 (partial) | White paper voice decisions | You decide positioning. |

---

## Bucket E — Recurring / cadence (3)

Templates and reminders, not one-shot tickets.

| ID | Title | What to do with it |
|---|---|---|
| PROD-309 | Weekly report — Sunday cadence (written + video) | Convert to a `/loop` scheduled task: every Sunday, draft report from this week's Linear + git activity. Past due 2026-04-19. |
| PROD-290 | Ideas Skill (capture → feasibility → prototype path) | Build once, then it runs ambient. |
| PROD-295 | Blog animation system | Build once, then per-post. |

---

## Recommended order (top 5)

Once the pre-flight is sorted, here's the order I'd run the loop in:

1. **PROD-304** — Google Auth for Layers. (Codeable, scoped, high-impact, lives in this repo.)
2. **PROD-305** — Credit system verification. (Urgent. Confirm env access first.)
3. **PROD-307** — Skill set authoring (`.claude/skills/`). (Quick wins, batch.)
4. **PROD-302** — Layers white paper update. (Doc pass, fast.)
5. **PROD-296** — HyperTool MCP research. (Research entry in `.ai-starter/research/`.)

Everything else is either out-of-repo, stale, recurring, or human.

---

## What "Ralph loop" actually does here

In this repo, the `/loop` skill drives **one** prompt repeatedly until the prompt's own success condition is met or you hit Stop. The right way to use it for a Linear ticket:

```
/loop Drive PROD-304 (Google Auth for Layers) red → green → refactor.
   - Use the AI Starter Kit contract in CLAUDE.md.
   - Acceptance criteria from the Linear issue (Google OAuth via Supabase Auth on
     portal and main app, JWT refresh, session persistence verified by Playwright).
   - Run `pnpm typecheck && pnpm test` between iterations.
   - Stop when all acceptance criteria pass and PR is open against `main`.
```

That's it. One ticket at a time. After each ticket completes:
- Mark Todo → Done in Linear,
- Open the PR (you review/merge),
- Come back and pick the next ticket.

Anything more ambitious than that is how repos get corrupted.

---

## Next step

Tell me:
1. **What to do with the dirty working tree** (commit / stash / discard which parts).
2. **Confirm PROD-304 as the first loop target** (or override).
3. **Confirm env access for PROD-305** (Hustle + Layers + LiteLLM endpoints + credentials in env vars I can verify locally? Or do I need you to spin them up?).

I will not start the loop until those three are answered.
