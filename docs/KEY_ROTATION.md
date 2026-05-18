# Key Rotation Runbook

Tracks: [PROD-407](https://linear.app/mirror-factory/issue/PROD-407)

> Companion docs: [SPEND_CAPS.md](./SPEND_CAPS.md), [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md), [RELEASE.md](./RELEASE.md)

This is the **proactive** rotation runbook — repo migrating to private, periodic rotation cadence, planned credential refresh. For **reactive** rotation when a key is suspected compromised, see [`INCIDENT_RUNBOOK.md`](./INCIDENT_RUNBOOK.md) scenario 4 ("Key compromise") first — it has the speed-prioritized version.

---

## Why rotation matters

The repo has lived in public state long enough that any contributor who's cloned, any GitHub Actions log, any caching CDN, or any leaked `.env` could carry a long-lived key. The cheapest fix: rotate everything once before going private, then rotate quarterly.

**This runbook moves you from "public repo state" to "private repo with fresh credentials" without breaking production.**

---

## TL;DR — Rotation order

Order matters. Some vendors have a grace period for the old key (good — zero-downtime rotation). Others revoke instantly. Rotate the safe-grace ones first; do the revoke-instantly ones during a planned window.

| # | Vendor | Env var | Grace period? | Window |
|---|---|---|---|---|
| 1 | OpenAI | `OPENAI_API_KEY` | New key live; old key still usable until you click revoke | Any time |
| 2 | Anthropic | `ANTHROPIC_API_KEY` | Same as OpenAI | Any time |
| 3 | Vercel AI Gateway | `AI_GATEWAY_API_KEY` | New key live; old usable until manual revoke | Any time |
| 4 | AssemblyAI | `ASSEMBLYAI_API_KEY` | New key live; old usable until revoke | Any time |
| 5 | Deepgram | `DEEPGRAM_API_KEY` | New key live; old usable until revoke | Any time |
| 6 | Resend | `RESEND_API_KEY` | New key live; old usable until revoke | Any time |
| 7 | Supabase | `SUPABASE_SERVICE_ROLE_KEY` | **Resets all role keys** — schedule a 10-min window | Maintenance window |
| 8 | Supabase | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Same — resets keys** | Bundle with #7 |
| 9 | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Old key continues until revoked; webhooks need re-deploy | Maintenance window |
| 10 | Google OAuth Client | `GOOGLE_CLIENT_SECRET` | Old usable until you click revoke | Any time |
| 11 | Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Once wired — not present today | n/a yet |

---

## Pre-flight (do once before any rotation)

1. **Take a snapshot of current env**
   - In Vercel → Project → Settings → Environment Variables → click the production view → screenshot or download. Save to `~/Layers-credentials-pre-rotation-2026-05-12.txt` outside the repo (this file should never be committed).
2. **Confirm rollback path**
   - For each env var: confirm you have access to the vendor dashboard to view/regenerate. If 2FA is involved, have the second factor ready.
3. **Pick a low-traffic window**
   - For grace-period keys (1-6, 10), any time is fine.
   - For instant-revoke keys (7, 8, 9), plan a 30-min window with no expected user traffic. Post a "scheduled maintenance" message in any user-facing channels.
4. **Verify pre-push hook**
   - Each Vercel env change auto-redeploys. Make sure `pnpm gates` passes locally — you don't want a hook failure mid-rotation.

---

## Per-vendor rotation steps

For each vendor:
1. Generate the new key
2. Update Vercel env var (Production + Preview, both)
3. Trigger redeploy (`Redeploy` button in Vercel, or push a no-op commit)
4. Verify the app still works (smoke check below)
5. Revoke the old key in the vendor dashboard
6. **Log the rotation** in the table at the bottom of this doc

### 1. OpenAI (`OPENAI_API_KEY`)

- **Generate new:** Platform → **Settings → API Keys → Create new secret key**. Name it `layers-prod-YYYY-MM`. Restrict to the Production project. Copy the secret.
- **Update Vercel:** Project → Settings → Environment Variables → find `OPENAI_API_KEY` → **Edit** → paste new → **Save** → check both Production and Preview.
- **Redeploy:** Vercel Deployments → latest → **Redeploy** with "Use existing Build Cache" off.
- **Smoke:** `curl https://layers.mirrorfactory.ai/api/transcribe/stream/preflight` → 200 within 2s, JSON body has `provider: "...", ready: true`.
- **Revoke old:** Platform → API Keys → old key → **Revoke** → confirm.

### 2. Anthropic (`ANTHROPIC_API_KEY`)

- **Generate new:** Console → **Settings → API Keys → Create Key**. Name `layers-prod-YYYY-MM`. Workspace = your prod workspace.
- **Update Vercel:** as above.
- **Redeploy.**
- **Smoke:** open `/chat`, send "hello", expect a streaming response within 3s. If 500/502, the new key isn't valid yet — re-check Vercel env value.
- **Revoke old:** Console → API Keys → old key → **Revoke**.

### 3. Vercel AI Gateway (`AI_GATEWAY_API_KEY`)

- **Generate new:** Vercel → **AI Gateway → API Keys → Create**. Scope to the prod team.
- **Update Vercel env, redeploy, smoke as above.**
- **Revoke old:** AI Gateway → API Keys → old → delete.

### 4. AssemblyAI (`ASSEMBLYAI_API_KEY`)

- **Generate new:** Dashboard → **Account → API Keys → Create new key**.
- **Update Vercel env, redeploy.**
- **Smoke:** open `/record/live` → click Start → see partials within 1-2s. If "provider issue" state appears, key is wrong — recheck Vercel value.
- **Revoke old:** Dashboard → API Keys → old → revoke.

### 5. Deepgram (`DEEPGRAM_API_KEY`)

- **Generate new:** Console → **Project Settings → API Keys → Create New Key**. **Important**: select scope **Member** or **Admin** (not Project Member — see [PROD-394](https://linear.app/mirror-factory/issue/PROD-394) for why Project Member can't mint temporary streaming tokens).
- **Update Vercel env, redeploy.**
- **Smoke:** in Settings switch streaming model to Deepgram, open `/record/live` → record 5s → partials should appear within 1-2s. Then switch back to AssemblyAI default.
- **Revoke old:** Console → API Keys → old → revoke.

### 6. Resend (`RESEND_API_KEY`)

- **Generate new:** Dashboard → **API Keys → Create Key**. Permission = **Full Access**.
- **Update Vercel env, redeploy.**
- **Smoke:** trigger a transactional email (e.g. magic-link sign-in flow) and confirm receipt.
- **Revoke old:** Dashboard → API Keys → old → delete.

### 7 + 8. Supabase Service Role + Anon (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

> ⚠️ **Maintenance window required.** Rotating these resets ALL role keys atomically — there is no grace period. Plan ~10 min downtime.

- **Step 1: Take a fresh DB snapshot** before rotation: Supabase Dashboard → Database → Backups → **Take backup now**.
- **Step 2: Reset keys:** Supabase Dashboard → Project Settings → **API** → click **Reset** next to each key. Both new keys appear immediately.
- **Step 3: Update Vercel env atomically:**
  - Edit `SUPABASE_SERVICE_ROLE_KEY` → new value → Save.
  - Edit `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new value → Save.
  - **Do both BEFORE redeploy** — otherwise mid-deploy state will have mismatched keys.
- **Step 4: Redeploy.** Browser users will be signed out (anon key changed) — they re-sign-in cleanly.
- **Smoke:**
  - Hit `/` → 200, public landing renders.
  - Hit `/api/internal/health` (with `INTERNAL_ADMIN_TOKEN` header) → 200 with `supabase: "ok"`.
  - Sign in to `/sign-in` → succeeds.
  - Open `/meetings` → list renders for the signed-in user.

### 9. Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

> ⚠️ **Maintenance window required.** Webhook secret rotation requires re-pointing the Stripe webhook endpoint.

- **Step 1: Generate new secret key:** Stripe Dashboard → Developers → **API Keys → Create restricted key**. Permissions per `docs/STRIPE.md` (if it exists) or "Subscriptions: Read & Write, Customers: Read & Write, Webhooks: Read".
- **Step 2: Update Vercel `STRIPE_SECRET_KEY` env, redeploy.**
- **Step 3: Stripe Dashboard → Webhooks → find the prod endpoint → click Reveal → copy the new signing secret → update `STRIPE_WEBHOOK_SECRET` in Vercel env → redeploy.**
- **Step 4: Test event:** Stripe → Webhooks → endpoint → **Send test webhook** with a `customer.subscription.created` event → verify it lands in Vercel runtime logs as 200.
- **Step 5: Revoke old key:** Dashboard → API Keys → old restricted key → revoke.

### 10. Google OAuth (`GOOGLE_CLIENT_SECRET`)

- **Generate new secret:** Google Cloud Console → APIs & Services → **Credentials** → find the Layers OAuth 2.0 Client ID → **+ Add Secret**. Note: most projects only allow 2 secrets concurrently, so you'll have to delete an old unused one first.
- **Update Vercel `GOOGLE_CLIENT_SECRET`, redeploy.**
- **Smoke:** sign out, then sign in with Google → succeeds.
- **Revoke old:** same Credentials page → old secret → **Delete**.

### 11. Inngest (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)

- Not yet wired into the repo. When background-job system lands, add rotation steps here. Until then, no-op.

---

## Going-private migration (one-time, today's task)

If this is **the first** rotation (going from public repo → private), do this once:

1. **Snapshot env (pre-flight step 1).**
2. **Make the repo private:** GitHub → mirror-factory/layers → Settings → General → scroll to **Danger Zone → Change repository visibility → Make private**. Read GitHub's warnings about forks/stars getting nuked.
3. **Verify forks are gone:** GitHub → Insights → Forks. Should be empty after private switch.
4. **Run rotations 1-11 above** in the order listed.
5. **Update GitHub Actions secrets** (Settings → Secrets and variables → Actions → repository secrets) for any CI-side keys (Apple cert, Google Play key, Vercel deploy token).
6. **Tell collaborators:** if anyone else has clone access, push them to re-clone over SSH or PAT. Old HTTPS-cached creds will fail.
7. **Log this completion** in the changelog at the bottom.

---

## Quarterly rotation cadence (recommended)

Once the repo is private, rotate every 90 days OR after any of:

- A departing collaborator who had clone access
- A suspected leak (vendor flags unusual usage)
- A vendor service incident where the key may have been exposed
- A major release (every M6 cut)

**Calendar reminder:** add a recurring item to your calendar — 90 days from the last rotation date logged below.

---

## Verification across the runbook

After ANY rotation, run this top-to-bottom smoke list once:

1. [ ] `/` loads (200).
2. [ ] `/sign-in` → Google flow succeeds end-to-end.
3. [ ] `/record` → preflight returns 200 with `provider: "..."`, `ready: true`.
4. [ ] `/record/live` → starts a session, partials within 2s, finalize succeeds.
5. [ ] `/meetings/[id]/page.tsx` opens an existing meeting with no errors.
6. [ ] `/chat` → sends a message, streaming response arrives.
7. [ ] `/settings/integrations` → loads (validates `oauth_clients` + `api_keys` RLS works).
8. [ ] `/api/internal/health` returns 200 with all components `ok`.
9. [ ] A test Stripe webhook lands as 200 in runtime logs.
10. [ ] No alert email in `admin@mirafactory.ai` in the last hour.

If any item fails, **roll back the relevant Vercel env to the old value, redeploy, and triage**.

---

## Rotation log

Append a row each rotation. Most-recent on top.

| Date | Rotations performed | Operator | Notes |
|---|---|---|---|
| _(none yet)_ | | | |

---

_Last updated: 2026-05-12. Owner: @alfonso._
