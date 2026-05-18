# Security / Dependency / Release-Readiness Worker Report

Date: 2026-05-18
Branch audited: `release/external-tester-readiness-2026-05-17` (v0.1.158)
Default branch scanned by Dependabot: `development` (v0.1.96)
Worker: Claude Sonnet 4.6 via Claude Code
References: `docs/RELEASE_TEST_MATRIX.md` Gate 27, `docs/RELEASE.md`, prior run `docs/evidence/2026-05-18-release-test-matrix/release-test-run-summary.md`

---

## 1. Dependency Audit (Gate 27 — pnpm audit)

**Command:** `pnpm audit --audit-level=moderate`
**Result: PASS — "No known vulnerabilities found"**

The current working branch (`release/external-tester-readiness-2026-05-17`) resolves all dependencies to patched versions. pnpm audit against this branch's lockfile is clean.

---

## 2. Dependabot Default-Branch Alert Audit (Gate 27 — GitHub advisory)

**Command:** `gh api repos/mirror-factory/layers/dependabot/alerts`

**Result: FAIL — 29 open alerts on the default branch (`development` at v0.1.96 / `next 15.5.15`)**

| Severity | Open Count |
|----------|------------|
| HIGH     | 17         |
| MEDIUM   | 10         |
| LOW      | 2          |
| **Total open** | **29** |

### Root Cause

Dependabot scans the GitHub default branch. The repo's default branch is `development`, currently at commit `1c975f162ba45b64793a847aad6abacfc156021c` (v0.1.96). This branch has `next: 15.5.15` and an older lockfile. The release branch at v0.1.158 has already fixed these by upgrading to `next: 15.5.18`. The fix exists but has not been merged into `development` yet — that is exactly what PR #88 delivers.

### Affected Packages on Default Branch

| Package | Version on default branch | Patched version | CVEs (open) | Notes |
|---------|--------------------------|-----------------|-------------|-------|
| `next`  | 15.5.15 | 15.5.16 (most) / 15.5.18 (alerts 22-23) | 20 alerts (9 HIGH, 7 MED, 2 LOW, 2 more HIGH) | All resolved at 15.5.18; current branch already at 15.5.18 |
| `hono`  | (older via transitive) | 4.12.16 | 2 MED | Current branch lockfile resolves to 4.12.18 (patched) |
| `systeminformation` | present (transitive, dev scope) | 5.31.6 | 1 HIGH | Not present in current branch lockfile at all |
| `protobufjs` | (transitive) | — | 6 (HIGH+MED) | Current branch pnpm audit shows no alerts; lockfile resolves to patched version |

### Notable Next.js CVEs (all patched at 15.5.18)

| Alert # | Severity | Summary |
|---------|----------|---------|
| 22, 23 | HIGH | Middleware/Proxy bypass in App Router via segment-prefetch routes (incomplete fix follow-up) — requires 15.5.18 |
| 24, 25 | HIGH | Middleware/Proxy bypass in App Router via segment-prefetch routes — requires 15.5.16 |
| 34, 35 | HIGH | SSRF in WebSocket upgrade applications |
| 36, 37 | HIGH | DoS via Server Components |
| 27, 28 | HIGH | DoS via connection exhaustion (Cache Components) |
| 40, 41 | HIGH | Middleware/Proxy bypass in Pages Router (i18n) |

**Current branch (15.5.18) is patched for all of the above. The pnpm audit confirms no known vulnerabilities.**

---

## 3. PR #88 Review and Check Status

**Commands:**
```
gh pr view 88 --json number,title,state,headRefName,baseRefName,mergeable,reviewDecision,url,author
gh pr checks 88
gh pr view 88 --json reviews
```

| Field | Value |
|-------|-------|
| Title | Release readiness QA and native build fixes |
| State | OPEN |
| Base | `development` |
| Head | `release/external-tester-readiness-2026-05-17` |
| Mergeable | YES |
| Review Decision | **REVIEW_REQUIRED** |
| Reviews | **0 (none submitted)** |
| URL | https://github.com/mirror-factory/layers/pull/88 |

### CI Check Results

| Check | Result | Duration |
|-------|--------|----------|
| Tier 0-1 Fast Gates | **PASS** | 1m35s |
| Tier 2 Focused Browser Proof | **PASS** | 2m24s |
| Vercel Preview | **PASS** | deployed |
| Tier 3 Broad Browser Matrix | SKIPPING (optional) | — |
| Self-hosted Web Proof | SKIPPING (optional) | — |
| Android Native Proof | SKIPPING (optional) | — |

**Result: BLOCKED — all CI passes but 1 required review approval is missing. `reviewDecision: REVIEW_REQUIRED` with 0 reviews. Branch protection requires 1 approving review before merge.**

---

## 4. Branch Protection State

**Command:** `gh api repos/mirror-factory/layers/branches/{branch}/protection`

| Branch | Protected | Required Approvals | Status Checks Required | Force Push Blocked | Enforce Admins |
|--------|-----------|-------------------|----------------------|--------------------|----------------|
| `main` | YES | 1 | Tier 0-1, Tier 2, Web (Vercel) | YES | YES |
| `staging` | YES | 1 | Tier 0-1, Tier 2, Web (Vercel) | YES | YES |
| `development` | YES | 1 | Tier 0-1, Tier 2 | YES | YES |

**Result: PASS — All three release branches are protected per the RELEASE.md spec.** The `development` branch correctly lacks the Vercel check (previews only deploy for PRs into development, not for the branch itself at this stage). The `staging`/`main` Vercel requirement is correct.

---

## 5. Old `dev` Branch Warning

**Command:** `gh api repos/mirror-factory/layers/branches/dev`

- `origin/dev` still exists, is **unprotected**, at commit `7ab71c3` (v0.1.75, `next 15.5.15`).
- Per `docs/RELEASE.md` and `docs/RELEASE_PIPELINE.md`: *"Do not delete or retire `dev` until PR #88 has advanced `development` and a reviewer confirms there is no unique work left there."*
- Dependabot does NOT scan `origin/dev` (it only scans the default branch, `development`).
- **No immediate security risk from this branch** — it is not deployed to any domain and is not the Dependabot scan target. Risk is limited to accidental reference.

**Result: WARN — branch should be retired after PR #88 merges, per existing documented plan.**

---

## 6. Branch Promotion State

**Command:** `git log --oneline origin/main..origin/development` → 9 commits ahead

| Branch | Commit | Version | Next.js | Ahead of main |
|--------|--------|---------|---------|---------------|
| `main` | 88eb43c | (unknown, older) | 15.5.x (unknown) | — |
| `staging` | (not checked) | — | — | — |
| `development` (default) | 1c975f1 | 0.1.96 | 15.5.15 (VULNERABLE) | 9 commits ahead |
| `release/external-tester-readiness-2026-05-17` | 3d79936 | 0.1.158 | 15.5.18 (PATCHED) | PR #88 targeting dev |

**The security fix path is:**
1. PR #88 reviewed and merged → `development` reaches v0.1.158, next 15.5.18, all 29 Dependabot alerts resolve.
2. `development` → `staging` PR opened, CI passes, reviewer approves, merged.
3. `staging` → `main` PR opened, CI passes, reviewer approves, merged → production patched.

None of steps 2 or 3 have been started.

---

## 7. Secret Scan

No secret scanning run performed in this pass (no `git-secrets`, `trufflehog`, or `gitleaks` installed in this environment). Prior worker (web-worker-report in previous run) reported local audit and source secret checks passed. Dependabot secret scanning is not enabled as a separate check per GitHub API.

**Recommendation:** Add `pnpm dlx trufflehog git file://. --since-commit HEAD~10` or equivalent to the Tier 2 gate if not already wired.

---

## 8. Blockers Summary

| ID | Severity | Status | Description | Resolving Action |
|----|----------|--------|-------------|-----------------|
| SEC-1 | BLOCKER | OPEN | 29 Dependabot alerts on default branch — 17 HIGH including Next.js middleware bypass CVEs and SSRF | Merge PR #88 into `development` (all CI passes, only needs 1 reviewer approval) |
| SEC-2 | BLOCKER | OPEN | PR #88 not reviewed — `REVIEW_REQUIRED`, 0 reviews | CrazySwami or another authorized reviewer approves PR #88 |
| SEC-3 | P1 | OPEN | Security fixes stuck in release branch — `staging` and `main` still need promotion PRs after PR #88 | Open `development → staging` then `staging → main` PRs after PR #88 merges |
| SEC-4 | WARN | OPEN | `origin/dev` unprotected branch exists at v0.1.75 | Retire per RELEASE.md plan after PR #88 lands |
| SEC-5 | INFO | — | No secret scan tooling wired into gate | Add to Tier 2 gate |

---

## Next Actions

1. **Immediate — assign a reviewer to PR #88.** All CI checks pass, the PR is mergeable. The only gate is 1 human review. URL: https://github.com/mirror-factory/layers/pull/88
2. **After PR #88 merges:** Verify Dependabot auto-resolves the 29 open alerts (GitHub will re-scan `development` within minutes of merge).
3. **Open `development → staging` PR** with the now-patched `development` branch.
4. **Open `staging → main` PR** after staging soak.
5. **Retire `origin/dev`** after confirming no unique work remains (per RELEASE.md checklist item).
6. **Consider adding secret-scan step** (`trufflehog` or similar) to Tier 2 gate.

---

## TLDR

**Gate 27 (Security) is a release BLOCKER in two parts:**

- `pnpm audit` on the working branch is **CLEAN** — the code being shipped has no known vulnerabilities.
- GitHub Dependabot shows **29 open alerts (17 HIGH)** on the default branch (`development`) because that branch still has `next 15.5.15` (vulnerable to middleware bypass, SSRF, DoS, XSS). The fix — `next 15.5.18` — is already on this branch and will land on `development` the moment **PR #88 gets its one required review approval**. All CI checks on PR #88 are currently passing (Tier 0-1, Tier 2, Vercel).

**Action required: one reviewer must approve PR #88.** That single review unblocks the merge, clears all 29 Dependabot alerts on the default branch, and opens the path for `development → staging → main` promotion.
