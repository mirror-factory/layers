# MFDR -- MCP Rate Limits

PROD-404 ships sliding-window rate limits for `app/api/mcp/[transport]/route.ts`.

## Decision

Use an in-process `Map<string, number[]>` sliding-window counter, keyed by
`{tier}:{id}:{bucket}`. Pruned lazily on every request. Memory is bounded by
the largest active window (1 day) times the number of distinct (user, tool)
keys observed in that window.

## Why not Vercel KV (yet)

The repo currently has no `KV_*` env vars wired and the staging deploy is
not yet pinned to a Vercel project that owns a KV namespace (see PROD-383
and `docs/RELEASE.md`). Blocking PROD-404 on KV provisioning would slip
the auth-hardening work in PROD-402.

Once KV is provisioned, swap the in-memory store for KV with `INCR` and a
TTL equal to the largest window. The `applyRateLimit` interface is
deliberately storage-agnostic: only the internal `store.hit` implementation
in `lib/middleware/rate-limit.ts` needs to change. Every caller already
goes through `applyRateLimit`.

A `// TODO(PROD-404): swap to Vercel KV` marker is left at the call site.

## Limits

Defaults (all env-tunable):

| tier            | window | limit  | env var                                       |
|-----------------|--------|--------|-----------------------------------------------|
| read tools / client     | 60s    | 60     | `MCP_RATE_LIMIT_READ_PER_MIN`                 |
| `prepare_notes_push` / client | 60s | 6  | `MCP_RATE_LIMIT_NOTES_PUSH_PER_MIN`           |
| `start_recording` / client    | 60s | 2  | `MCP_RATE_LIMIT_START_RECORDING_PER_MIN`      |
| per user                | 1h     | 600    | `MCP_RATE_LIMIT_PER_USER_PER_HOUR`            |
| per user                | 1d     | 5000   | `MCP_RATE_LIMIT_PER_USER_PER_DAY`             |

Read-tier tools: `search_meetings`, `list_meetings`, `get_meeting`,
`get_transcript`, `get_summary`, `show_meeting_dashboard`.

## Bypass

`MCP_RATE_LIMIT_BYPASS_USER_IDS=<csv>` skips every tier. Used for:

- internal load tests
- the `mcp-runtime-proof` script
- on-call rapid debugging

## Known limitations

1. **Per-instance counters**: a Vercel deployment with N warm lambdas can
   serve up to `N * configured-limit` per region in the worst case. This is
   acceptable for an alpha rollout where N is small and limits are
   conservative. KV migration removes this entirely.
2. **Cold starts reset state**: a cold lambda starts with empty counters.
   Same mitigation: KV.
3. **Single-region only**: counters are not replicated cross-region. KV is
   regional too, so this requires a global store (Upstash, DurableObjects,
   etc.) if/when we deploy multi-region.

## Failure mode

If `applyRateLimit` itself throws, the `withRoute` wrapper around the MCP
handler converts it to a 500 with `{error.code: "internal_error"}`. The
limiter never lets a thrown error escape upstream as an unhandled rejection.

## Verification

`tests/integration/lib-middleware-rate-limit.test.ts` spams 100 calls in
~30s and asserts:

- 60 succeed (first window, 60/min read tier)
- 40 are rejected with HTTP 429
- the 429 carries `Retry-After`
- the body matches the PROD-405 structured error envelope
