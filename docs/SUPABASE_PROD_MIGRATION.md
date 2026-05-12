# Supabase production migration audit

Tracks: [PROD-224](https://linear.app/mirror-factory/issue/PROD-224)

> Companion docs: [SPEND_CAPS.md](./SPEND_CAPS.md), [KEY_ROTATION.md](./KEY_ROTATION.md), [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md), [RELEASE.md](./RELEASE.md)

This is the single source of truth for **what's applied to the Audio Layer production Supabase vs. what's in `supabase/migrations/` in this repo**. Updated on every migration push — re-derive the rows below by running:

```
mcp__claude_ai_Supabase__list_migrations({ project_id: "psatqzrakxauktmzahfc" })
mcp__claude_ai_Supabase__list_tables({ project_id: "psatqzrakxauktmzahfc", schemas: ["public"] })
```

Audit performed 2026-05-12 by Claude in the main thread of the marathon session.

---

## 🚨 Critical security finding — must address before alpha invite

The Supabase MCP advisory flagged **9 tables in production with RLS disabled**. These tables are fully exposed to the anon + authenticated roles via the Supabase client libraries — **any anon-key holder can read or modify every row**.

Affected tables:

```
public.traces
public.spans
public.tool_registry
public.eval_suites
public.eval_runs
public.cost_logs
public.regression_tests
public.connector_status
public.audit_log
```

**These are observability / dev-kit tables**, not user data. Even so, they contain enough operational signal (cost figures, internal tooling traces) that exposing them publicly is bad practice and likely also bad-publicity if discovered.

**Remediation candidate (DO NOT run blindly — enabling RLS without policies blocks all reads):**

```sql
ALTER TABLE public.traces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_suites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regression_tests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_status  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
```

After enabling, **add policies** (or the tables become unreadable through anon/authenticated roles, which may be desired for some). Service-role bypasses RLS, so server-side writes from API routes that use `getSupabaseServer()` will continue to work regardless.

**Decision needed**: are these dev-kit tables meant to be service-role-only (yes, RLS-enabled with no policies, server-side only) or should they have read policies (e.g. admin-only) for the dev-kit dashboard?

A separate ticket for the policy work is recommended — this audit doc tracks "RLS state on these tables" as a checklist item, but doesn't apply the fix unilaterally.

---

## Migration state at audit time

### Production has applied 7 migrations (tracked in `supabase_migrations.schema_migrations`)

| Version | Name | Applied date (UTC) |
|---|---|---|
| 20260417202417 | audio_layer_initial_schema | 2026-04-17 |
| 20260418194755 | add_cost_breakdown_column | 2026-04-18 |
| 20260419163847 | ai_dev_kit_extensions_and_helpers | 2026-04-19 |
| 20260419163937 | ai_dev_kit_core_tables | 2026-04-19 |
| 20260423035727 | add_oauth_codes_table | 2026-04-23 |
| 20260423035732 | add_webhooks_tables | 2026-04-23 |
| 20260426214937 | mcp_oauth | 2026-04-26 |

### Repo has 7 migrations (under `supabase/migrations/`)

| Filename | Creates | Maps to production migration |
|---|---|---|
| 00001_ai_dev_kit_schema.sql | traces, spans, tool_registry, eval_suites, eval_runs, eval_results, cost_logs, regression_tests, prompt_versions, deployment_snapshots, etc. | `audio_layer_initial_schema` + `add_cost_breakdown_column` + `ai_dev_kit_extensions_and_helpers` + `ai_dev_kit_core_tables` (roughly) |
| 00002_pricing_config_versions.sql | pricing_config_versions | ❌ **NOT applied — gap** |
| 00003_mcp_oauth.sql | oauth_codes, oauth_refresh_tokens | `add_oauth_codes_table` + partial `mcp_oauth` |
| 00004_calendar_connections.sql | calendar_connections | ❌ **NOT applied — gap** |
| 00005_webhooks.sql | webhooks, webhook_deliveries | `add_webhooks_tables` |
| 00006_oauth_clients_and_api_keys.sql | oauth_clients, api_keys | ✅ **Applied 2026-05-12 manually via SQL editor** but NOT registered in `schema_migrations` ledger |
| 00007_recordings_storage_bucket.sql | `recordings` bucket + 3 RLS policies on storage.objects | ❌ **NOT applied — newly shipped today** |

### Tables actually in production today

(via `list_tables` MCP call, 2026-05-12)

```
public.meetings              (rls=on, 18 rows)
public.profiles              (rls=on, 0 rows)
public.traces                (rls=OFF) — security finding
public.spans                 (rls=OFF) — security finding
public.tool_registry         (rls=OFF) — security finding
public.eval_suites           (rls=OFF) — security finding
public.eval_runs             (rls=OFF) — security finding
public.cost_logs             (rls=OFF) — security finding
public.regression_tests      (rls=OFF) — security finding
public.connector_status      (rls=OFF) — security finding
public.audit_log             (rls=OFF) — security finding
public.meeting_embeddings    (rls=on, 37 rows)
public.oauth_codes           (rls=on, 0 rows)
public.webhooks              (rls=on, 0 rows)
public.webhook_deliveries    (rls=on, 0 rows)
public.oauth_refresh_tokens  (rls=on, 65 rows)
public.oauth_clients         (rls=on, 0 rows) — landed 2026-05-12 (PROD-403)
public.api_keys              (rls=on, 0 rows) — landed 2026-05-12 (PROD-403)
```

---

## What needs to happen

### Gap 1 — apply 00002_pricing_config_versions.sql

**Risk:** Low. Pure DDL, adds a single table.

**Run order:** Any time.

**Reversibility:** `drop table pricing_config_versions cascade;`

**SQL:** Open `supabase/migrations/00002_pricing_config_versions.sql` in this repo, paste into Supabase SQL Editor on project `psatqzrakxauktmzahfc`, click Run.

**Verify:**
```sql
select * from information_schema.tables where table_name = 'pricing_config_versions';
```

### Gap 2 — apply 00004_calendar_connections.sql

**Risk:** Low. Pure DDL, adds a single table.

**Run order:** Any time.

**Reversibility:** `drop table calendar_connections cascade;`

**SQL:** Open `supabase/migrations/00004_calendar_connections.sql`, paste into SQL editor.

**Verify:**
```sql
select * from information_schema.tables where table_name = 'calendar_connections';
```

### Gap 3 — apply 00007_recordings_storage_bucket.sql

**Risk:** Medium. Affects `storage.buckets` (one row) + `storage.objects` policies (3 policies). The bucket is new (`id = 'recordings'`); if it already existed under a different name, this would conflict.

**Run order:** Any time after Gap 1 + 2.

**Reversibility:**
```sql
drop policy if exists "recordings: user reads own folder" on storage.objects;
drop policy if exists "recordings: user inserts into own folder" on storage.objects;
drop policy if exists "recordings: user deletes own folder" on storage.objects;
delete from storage.buckets where id = 'recordings';
```
(Won't delete uploaded objects automatically — those would need a separate cleanup.)

**SQL:** `supabase/migrations/00007_recordings_storage_bucket.sql`.

**Verify:**
```sql
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recordings';
select policyname from pg_policies where schemaname = 'storage' and policyname like 'recordings:%';
```

### Gap 4 — backfill schema_migrations entry for 00006

I applied `00006_oauth_clients_and_api_keys.sql` via SQL editor earlier today; the tables exist, but Supabase's migration ledger doesn't know about it. Insert the row so future `supabase db push` runs don't try to re-apply it:

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20260512050000', 'oauth_clients_and_api_keys')
on conflict do nothing;
```

(Date is approximate to when the manual apply happened today.)

### Gap 5 — Critical security finding (see top of doc)

Decide whether the 9 dev-kit tables should be:

- **Service-role only** (enable RLS with no policies — server-side reads through `getSupabaseServer()` still work, anon-side reads are blocked)
- **Admin-readable** (enable RLS, add a policy gated on `auth.uid()` matching an admin role)
- **Currently-by-design public** (highly unlikely — these contain operational data)

File a separate ticket for this work. The remediation SQL above only enables RLS without adding policies — apply it only if you've decided the tables should be server-side-only.

---

## Suggested apply order (all 5 gaps)

| Step | Action | Run by | Time |
|---|---|---|---|
| 1 | Decide on RLS approach for the 9 dev-kit tables; file a follow-up ticket | @alfonso | 5 min |
| 2 | Apply 00002 (pricing_config_versions) | @alfonso via SQL editor | 1 min |
| 3 | Apply 00004 (calendar_connections) | @alfonso via SQL editor | 1 min |
| 4 | Apply 00007 (recordings_storage_bucket) | @alfonso via SQL editor | 2 min |
| 5 | Backfill `schema_migrations` row for 00006 | @alfonso via SQL editor | 1 min |
| 6 | Apply the chosen RLS strategy for the 9 dev-kit tables | @alfonso, after step 1 decision | 5-15 min |
| 7 | Re-run this audit to confirm all gaps closed | Claude or @alfonso | 2 min |

Total: ~20-30 min including the security remediation decision.

---

## Going forward

**Convention for new migrations** (effective immediately, since 00007 was the first to need this discipline):

1. Write the migration in `supabase/migrations/0000N_<descriptive_name>.sql`.
2. Apply locally via `supabase db push` if you have the local Supabase CLI linked.
3. For production, apply manually via SQL editor (until CI-driven migration is wired — separate ticket).
4. After production apply, **backfill the `supabase_migrations.schema_migrations` row** so the ledger and the file system agree:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('<timestamp>', '<descriptive_name>')
   on conflict do nothing;
   ```
5. Re-run this audit (the MCP calls at the top of this doc).

**Future**: wire a GitHub Actions job that runs `supabase db push` against production on every merge to `main` that touches `supabase/migrations/*`. Tracked separately when we set up the dev/staging/prod branch pipeline (PROD-383).

---

_Last audited: 2026-05-12. Owner: @alfonso. Maintained by: any agent or operator touching `supabase/migrations/`._
