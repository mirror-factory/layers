/**
 * MCP rate limiting (PROD-404).
 *
 * Sliding-window counters across three tiers:
 *
 *   1. Per-client / minute -- bursty tool-specific cap.
 *      - 60 for read tools  (search_meetings, list_meetings, get_meeting,
 *                             get_transcript, get_summary)
 *      - 6  for prepare_notes_push
 *      - 2  for start_recording
 *   2. Per-user / hour     -- 600 across all tools.
 *   3. Per-user / day      -- 5000 across all tools.
 *
 * All limits are env-tunable (see RATE_LIMIT_DEFAULTS below). A user listed
 * in MCP_RATE_LIMIT_BYPASS_USER_IDS bypasses every tier.
 *
 * Storage: in-memory Map keyed by `${tier}:${id}:${bucket}`. The map is
 * pruned lazily on each call. This works for a single Node process; in
 * Vercel the lambdas may be cold-started independently, which means the
 * effective per-region limit is N * configured-limit. That's documented
 * in docs/MFDR-rate-limits.md and is acceptable for an alpha rollout.
 *
 * TODO(PROD-404): swap to Vercel KV once KV_* env vars are wired so limits
 * survive across instances and survive cold starts. The interface below is
 * deliberately storage-agnostic; only `incrementWindow` needs to change.
 */

import { respondWithError } from "@/lib/errors/respond";
import { ERROR_CODES } from "@/lib/errors/codes";
import { log } from "@/lib/logger";

// Read-tier tool names (60/min default).
const READ_TOOLS = new Set([
  "search_meetings",
  "list_meetings",
  "get_meeting",
  "get_transcript",
  "get_summary",
  "show_meeting_dashboard",
]);

const NOTES_PUSH_TOOL = "prepare_notes_push";
const START_RECORDING_TOOL = "start_recording";

export type RateLimitedTool = string;

interface ParsedLimits {
  perClientReadPerMinute: number;
  perClientNotesPushPerMinute: number;
  perClientStartRecordingPerMinute: number;
  perUserPerHour: number;
  perUserPerDay: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readLimits(): ParsedLimits {
  return {
    perClientReadPerMinute: parsePositiveInt(
      process.env.MCP_RATE_LIMIT_READ_PER_MIN,
      60,
    ),
    perClientNotesPushPerMinute: parsePositiveInt(
      process.env.MCP_RATE_LIMIT_NOTES_PUSH_PER_MIN,
      6,
    ),
    perClientStartRecordingPerMinute: parsePositiveInt(
      process.env.MCP_RATE_LIMIT_START_RECORDING_PER_MIN,
      2,
    ),
    perUserPerHour: parsePositiveInt(
      process.env.MCP_RATE_LIMIT_PER_USER_PER_HOUR,
      600,
    ),
    perUserPerDay: parsePositiveInt(
      process.env.MCP_RATE_LIMIT_PER_USER_PER_DAY,
      5000,
    ),
  };
}

function readBypassUserIds(): Set<string> {
  const raw = process.env.MCP_RATE_LIMIT_BYPASS_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * Sliding window: store one timestamp per request inside the window. We
 * trim entries older than `windowMs` on every call. Memory bounded by the
 * largest active window (1 day) so worst case is `perUserPerDay` entries
 * per active user.
 */
interface SlidingWindowStore {
  hit(key: string, windowMs: number, limit: number, now: number): {
    allowed: boolean;
    count: number;
    retryAfterSeconds: number;
  };
  reset(): void;
}

function createInMemoryStore(): SlidingWindowStore {
  const buckets = new Map<string, number[]>();

  return {
    hit(key, windowMs, limit, now) {
      const cutoff = now - windowMs;
      const existing = buckets.get(key) ?? [];
      // Drop entries outside the window.
      let firstFresh = 0;
      while (firstFresh < existing.length && existing[firstFresh] <= cutoff) {
        firstFresh++;
      }
      const trimmed = firstFresh > 0 ? existing.slice(firstFresh) : existing;

      if (trimmed.length >= limit) {
        // The oldest in-window timestamp tells us when capacity frees up.
        const oldest = trimmed[0];
        const retryAfterMs = Math.max(0, oldest + windowMs - now);
        buckets.set(key, trimmed);
        return {
          allowed: false,
          count: trimmed.length,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      trimmed.push(now);
      buckets.set(key, trimmed);
      return { allowed: true, count: trimmed.length, retryAfterSeconds: 0 };
    },
    reset() {
      buckets.clear();
    },
  };
}

let store: SlidingWindowStore = createInMemoryStore();

/**
 * Test hook -- clears the in-memory window so each test starts fresh.
 * Not exported as a public API surface; only consumed by `tests/integration/`.
 */
export function __resetRateLimitStoreForTests(): void {
  store.reset();
}

export interface ApplyRateLimitOptions {
  userId: string;
  /** Stable identifier for the calling MCP client / token. */
  clientId: string;
  /** Tool being invoked. `null` for tools/list and other non-call ops. */
  tool: RateLimitedTool | null;
  /** Inbound request, used to thread x-request-id into the 429 response. */
  req: Request;
  /** Current time in ms (override for testing). */
  now?: number;
}

interface TierResult {
  tier: "client_minute" | "user_hour" | "user_day";
  retryAfterSeconds: number;
  limit: number;
  count: number;
}

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function clientLimitForTool(tool: string | null, limits: ParsedLimits): number {
  if (!tool) return limits.perClientReadPerMinute;
  if (tool === NOTES_PUSH_TOOL) return limits.perClientNotesPushPerMinute;
  if (tool === START_RECORDING_TOOL) return limits.perClientStartRecordingPerMinute;
  if (READ_TOOLS.has(tool)) return limits.perClientReadPerMinute;
  // Unknown tool name -- fall back to read tier (conservative).
  return limits.perClientReadPerMinute;
}

/**
 * Returns a 429 Response when the request should be denied. Returns null
 * when the request is allowed (and the counters have been incremented).
 */
export async function applyRateLimit(
  opts: ApplyRateLimitOptions,
): Promise<Response | null> {
  const limits = readLimits();
  const bypassIds = readBypassUserIds();
  if (bypassIds.has(opts.userId)) return null;

  const now = opts.now ?? Date.now();
  const tool = opts.tool;

  const tiers: Array<{
    tier: TierResult["tier"];
    key: string;
    windowMs: number;
    limit: number;
  }> = [
    {
      tier: "client_minute",
      key: `client_minute:${opts.clientId}:${tool ?? "any"}`,
      windowMs: ONE_MINUTE_MS,
      limit: clientLimitForTool(tool, limits),
    },
    {
      tier: "user_hour",
      key: `user_hour:${opts.userId}`,
      windowMs: ONE_HOUR_MS,
      limit: limits.perUserPerHour,
    },
    {
      tier: "user_day",
      key: `user_day:${opts.userId}`,
      windowMs: ONE_DAY_MS,
      limit: limits.perUserPerDay,
    },
  ];

  for (const t of tiers) {
    const result = store.hit(t.key, t.windowMs, t.limit, now);
    if (!result.allowed) {
      log.warn("mcp.rate_limited", {
        tier: t.tier,
        userId: opts.userId,
        clientId: opts.clientId,
        tool,
        limit: t.limit,
        count: result.count,
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return respondWithError(
        opts.req,
        ERROR_CODES.RATE_LIMITED,
        `Rate limit exceeded (${t.tier}). Retry after ${result.retryAfterSeconds}s.`,
        {
          retryAfterSeconds: result.retryAfterSeconds,
          details: {
            tier: t.tier,
            limit: t.limit,
            tool,
          },
        },
      );
    }
  }

  return null;
}
