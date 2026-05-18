# Release Flow — `development` → `staging` → `main`

Tracks: [PROD-383](https://linear.app/mirror-factory/issue/PROD-383)

## Why three tiers

We ship near-daily and we've already had production bugs that a soak environment
would have caught (PROD-378 OAuth typo, PROD-379 post-auth redirect, PROD-380
unsigned macOS DMG). Pushing direct to `main` ships those to real users. Three
tiers gives every change two chances to fail before it reaches them — and one
canonical place to test against staging credentials.

## The branches

| Branch        | Vercel                | Domain                            | Stripe       | Supabase                | Purpose                                                    |
| ------------- | --------------------- | --------------------------------- | ------------ | ----------------------- | ---------------------------------------------------------- |
| `main`        | **Production**        | `layers.mirrorfactory.ai`         | live keys    | prod project            | Real users. Promote from `staging` only.                   |
| `staging`     | Preview (pinned)      | `staging.layers.mirrorfactory.ai` | test keys    | staging project         | Pre-prod soak. Final QA before promoting to `main`.        |
| `development` | Preview (pinned)      | `dev.layers.mirrorfactory.ai`     | test keys    | dev project (or branch) | Active feature integration. Feature PRs land here first.   |
| feature/\*    | Preview (per-PR)      | Vercel-generated preview URL      | test keys    | dev project             | One per change. Vercel auto-creates a preview deploy.      |

## Day-to-day flow

1. **Cut a feature branch** off `development`:
   ```bash
   git checkout development && git pull
   git checkout -b alfonso/prod-321-new-thing
   ```
2. **Push and open a PR into `development`.** Vercel posts a preview URL on the PR. Manual smoke + reviewer required.
3. **Merge into `development`.** Vercel rebuilds `dev.layers.mirrorfactory.ai`. The whole team gets the change against dev creds. Soak overnight.
4. **Promote to `staging`.** Open a PR `development` -> `staging`. CI runs Tier 0/1/2. Reviewer required. Merge.
5. **Verify staging.** The `staging` push builds native release-candidate artifacts in GitHub Actions and uploads iOS to TestFlight when Apple secrets are configured. Sign in with a staging account, exercise the changed surface, watch error rates, and run any platform-specific manual checks listed in the PR.
6. **Promote to `main`.** Open a PR `staging` -> `main`. Reviewer required. CI runs the gate suite again. Merge -> Vercel deploys to `layers.mirrorfactory.ai`. Tag the release (`v0.1.X`) on `main` to publish GitHub Release download assets and upload the release-candidate iOS build to TestFlight.

**Hotfix path** (only when production is on fire):

```
hotfix/<issue> off main → PR straight to main + cherry-pick into staging + development
```

Reserve for actual incidents — broken auth, broken billing, leaking data. Anything else takes the long road.

## Vercel setup (one-time)

Open the Vercel project (`audio-layer` under the `mirror-factorys-projects-836be98a`
team) → **Settings**.

Current verified status as of 2026-05-17:

- GitHub/Vercel CI is deploying PR #88 through the `audio-layer` project under
  the `mirror-factorys-projects-836be98a` team.
- The local `.vercel/project.json` in this checkout points at a different Vercel
  project: `mirror-factory/layers` (`prj_sXKn0a66RmAsOG1mtid0ETrUiSsU`), which
  appears to be older/stale and configured as a Vite project.
- Do not mutate Vercel domains until the final owner project is reconciled. The
  intended production project should be the one that runs the actual Next.js CI
  deploys for this repo.
- The dev/staging domains are not verified yet because DNS is hosted at
  Cloudflare (`bowen.ns.cloudflare.com`, `cora.ns.cloudflare.com`) and the
  required records are not present.
- GitHub's default branch is `development`. Follow-up required: the old
  unprotected `dev` branch still exists at `0.1.75` and is ahead of the current
  protected `development` branch. Do not delete or retire `dev` until PR #88 has
  advanced `development` and a reviewer confirms there is no unique work left
  there.

Required Cloudflare records:

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `dev.layers` | `03e5eba20f4a886c.vercel-dns-017.com` |
| `CNAME` | `staging.layers` | `03e5eba20f4a886c.vercel-dns-017.com` |
| `TXT` | `_vercel` | `vc-domain-verify=dev.layers.mirrorfactory.ai,ab5d9cd48927b35731e8` |
| `TXT` | `_vercel` | `vc-domain-verify=staging.layers.mirrorfactory.ai,e55419497a240a420457` |

After DNS propagates, verify the two project domains from Vercel or run:

```bash
vercel api '/v9/projects/prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP/domains/dev.layers.mirrorfactory.ai/verify' --scope mirror-factorys-projects-836be98a -X POST
vercel api '/v9/projects/prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP/domains/staging.layers.mirrorfactory.ai/verify' --scope mirror-factorys-projects-836be98a -X POST
```

### 1. Production branch
- **Settings → Git → Production Branch:** `main`
- **Production deployments:** only from `main`. Disable "Deploy on push" for any other branch claiming production.

### 2. Pin staging
- **Settings → Domains:** add `staging.layers.mirrorfactory.ai`.
- **Domains → assign branch:** `staging`. (This makes the staging domain track the `staging` branch's latest deploy.)
- **Settings → Environment Variables → Staging environment:** copy production env vars, then swap to staging-tier creds:
  - `NEXT_PUBLIC_APP_URL=https://staging.layers.mirrorfactory.ai`
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → staging Supabase project
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO` → Stripe test mode
  - `ASSEMBLYAI_API_KEY` → staging key (separate budget)
  - `AI_GATEWAY_*` → staging gateway slug
  - `RESEND_API_KEY` + `RESEND_FROM` → staging sender
  - `INNGEST_*` → staging Inngest env

### 3. Pin development
- Add `dev.layers.mirrorfactory.ai`, assign branch `development`.
- Same env-var pattern for the **Development** Vercel environment, with dev-tier creds (can share the staging Supabase project at first if you want fewer projects to manage).

### 4. Block search engines on non-prod
Add to `dev.layers.mirrorfactory.ai` and `staging.layers.mirrorfactory.ai` only — either via a `vercel.json` route header or middleware:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
    }
  ]
}
```

(Production stays indexable.)

## GitHub branch protection (one-time)

`gh repo edit` doesn't cover everything; do this in **Settings → Rules → Rulesets** (or **Settings → Branches** classic):

Current status as of 2026-05-09: classic branch protection is enabled on
`development`, `staging`, and `main` with required PRs, required reviews,
required status checks, conversation resolution, admin enforcement, blocked force
pushes, and blocked deletions.

### Rule for `main`
- Restrict who can push: **disabled** (everyone goes through PR)
- Require a pull request: ✓
  - Required approvals: 1
  - Dismiss stale reviews on new commits
  - Require review from Code Owners (if you set CODEOWNERS)
- Require status checks to pass: ✓
  - Selected: `Tier 0-1 Fast Gates`, `Tier 2 Focused Browser Proof`, `Web (Vercel)`
  - Require branches to be up to date before merging: ✓
- Require linear history: ✓ (forces fast-forward / squash, no merge commits)
- Block force pushes: ✓
- Restrict deletions: ✓
- **Bypass list: empty.** No `--no-verify`, no admin override.

### Rule for `staging`
- Same as `main` minus the linear-history requirement (you may want merge commits here for promotion).
- Required approvals: 1
- Required checks: `Tier 0-1 Fast Gates`, `Tier 2 Focused Browser Proof`, `Web (Vercel)`
- Block force pushes: ✓

### Rule for `development`
- Require a PR: ✓
- Required approvals: 1
- Required checks: `Tier 0-1 Fast Gates`, `Tier 2 Focused Browser Proof`
- Block force pushes: ✓

## Auth + webhook allow-lists

Each tier needs its own URLs registered upstream. Without these, OAuth bounces and Stripe webhooks 404.

### Supabase Auth → URL Configuration
- Site URL: production only — `https://layers.mirrorfactory.ai`
- Additional Redirect URLs (allow-list):
  - `https://layers.mirrorfactory.ai/auth/callback`
  - `https://staging.layers.mirrorfactory.ai/auth/callback`
  - `https://dev.layers.mirrorfactory.ai/auth/callback`
  - `https://*-mirror-factory.vercel.app/auth/callback` (per-PR previews)
  - `http://localhost:3000/auth/callback`
  - `com.mirrorfactory.layers://auth/callback` (Capacitor iOS/Android deep-link OAuth)

### Google OAuth (Cloud Console -> Credentials -> OAuth 2.0 Client)
- Authorised JavaScript origins: prod + staging + dev domains.
- Authorised redirect URIs: each domain + `/auth/callback`.
- Native mobile sign-in should use the external browser/deep-link flow, not the embedded WebView. Add the app scheme redirect where required by the selected OAuth implementation.

### Stripe (test mode for dev/staging, live for prod)
- Webhook endpoints, one per environment:
  - Live → `https://layers.mirrorfactory.ai/api/billing/webhook`
  - Test → `https://staging.layers.mirrorfactory.ai/api/billing/webhook`
  - Test → `https://dev.layers.mirrorfactory.ai/api/billing/webhook`
- Each endpoint has its own `STRIPE_WEBHOOK_SECRET` — set the right one per Vercel env.

## Documentation rule (this file)

> **Never push directly to `main`.**
>
> Every change reaches `main` via a PR from `staging`, which itself received the change via a PR from `development` (or a feature branch). The only exception is a tagged hotfix from a `hotfix/*` branch with explicit incident write-up linked in the PR.

Cross-reference this rule from `AGENTS.md` so agents enforce it too.

## Local script: switch tiers safely

Add to `package.json`:

```json
{
  "scripts": {
    "dev:staging": "vercel env pull --environment=preview --git-branch=staging .env.local && next dev",
    "dev:dev": "vercel env pull --environment=preview --git-branch=development .env.local && next dev"
  }
}
```

Then `pnpm dev:staging` boots the dev server pointed at staging-tier creds locally. Useful for repro'ing prod-shaped bugs without touching prod data.

## Migration checklist (when first turning this on)

- [x] Create `staging` and `development` branches off current `main`.
- [x] Vercel: set production branch to `main`, pin staging + dev domains.
- [ ] Vercel: copy env vars, swap creds for staging + dev.
- [ ] Add Cloudflare DNS records for `staging.layers.` and `dev.layers.` subdomains.
- [ ] Supabase: add staging + dev redirect URLs.
- [ ] Google OAuth: add staging + dev origins + redirects.
- [ ] Stripe: create staging + dev webhook endpoints (test mode).
- [x] GitHub: enable branch protection on `main`, `staging`, `development`.
- [x] Update `AGENTS.md` to reference this doc and the "no direct push to main" rule.
- [ ] Retire old `dev` branch after #88 lands on protected `development` and any
  unique work is confirmed duplicated or intentionally superseded.
- [ ] Open a soak PR `development` → `staging` → `main` to prove the pipeline before retiring the direct-push habit.
- [ ] Confirm spend caps still configured (see [SPEND_CAPS.md](./SPEND_CAPS.md))
- [ ] Confirm credentials are fresh per quarterly cadence (see [KEY_ROTATION.md](./KEY_ROTATION.md))
- [ ] Run the manual real-device QA pass across all supported devices (see [RECORDING_MANUAL_QA.md](./RECORDING_MANUAL_QA.md))
- [ ] Close [PROD-383](https://linear.app/mirror-factory/issue/PROD-383).
