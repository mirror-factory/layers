/**
 * PROD-404 -- sliding-window rate limit middleware.
 *
 * Storage is in-process (see lib/middleware/rate-limit.ts and
 * docs/MFDR-rate-limits.md). Tests reset the store between cases so they
 * don't bleed into each other.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyRateLimit,
  __resetRateLimitStoreForTests,
} from "@/lib/middleware/rate-limit";

function buildRequest(): Request {
  return new Request("http://localhost/api/mcp/transport", { method: "POST" });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetRateLimitStoreForTests();
  // Strip every MCP_RATE_LIMIT_* env var so tests get the documented defaults.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("MCP_RATE_LIMIT_")) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("lib/middleware/rate-limit -- sliding-window enforcement", () => {
  it("allows the first 60 read-tool calls and rejects the next 40 in the same minute", async () => {
    const start = 1_700_000_000_000;
    const results: Array<{ allowed: boolean; status: number }> = [];

    // 100 calls spaced ~300ms apart -> all inside the same 60s window.
    for (let i = 0; i < 100; i++) {
      const res = await applyRateLimit({
        userId: "user_burst",
        clientId: "client_burst",
        tool: "list_meetings",
        req: buildRequest(),
        now: start + i * 300,
      });
      results.push({ allowed: res === null, status: res?.status ?? 0 });
    }

    const allowed = results.filter((r) => r.allowed).length;
    const rejected = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(60);
    expect(rejected).toBe(40);
    expect(results.slice(0, 60).every((r) => r.allowed)).toBe(true);
    expect(results.slice(60).every((r) => !r.allowed && r.status === 429)).toBe(
      true,
    );
  });

  it("returns the PROD-405 structured error body with retry_after_seconds and Retry-After", async () => {
    const start = 1_700_000_000_000;

    for (let i = 0; i < 60; i++) {
      const res = await applyRateLimit({
        userId: "user_struct",
        clientId: "client_struct",
        tool: "list_meetings",
        req: buildRequest(),
        now: start + i,
      });
      expect(res).toBeNull();
    }

    const blocked = await applyRateLimit({
      userId: "user_struct",
      clientId: "client_struct",
      tool: "list_meetings",
      req: buildRequest(),
      now: start + 1000,
    });

    expect(blocked).not.toBeNull();
    if (!blocked) throw new Error("expected 429");
    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number.parseInt(retryAfter ?? "0", 10)).toBeGreaterThan(0);

    const body = (await blocked.json()) as {
      error: {
        code: string;
        retryable: boolean;
        retry_after_seconds: number;
        request_id: string;
        docs_url: string;
        details?: Record<string, unknown>;
      };
    };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.retryable).toBe(true);
    expect(body.error.retry_after_seconds).toBeGreaterThan(0);
    expect(body.error.request_id).toMatch(/^req_/);
    expect(body.error.docs_url).toBe(
      "https://layers.mirrorfactory.ai/docs/errors#rate_limited",
    );
    expect(body.error.details).toMatchObject({ tier: "client_minute" });
  });

  it("enforces the prepare_notes_push tier at 6/minute", async () => {
    const start = 1_700_000_000_000;
    let allowedCount = 0;
    let firstRejectionIndex = -1;

    for (let i = 0; i < 10; i++) {
      const res = await applyRateLimit({
        userId: "user_notes",
        clientId: "client_notes",
        tool: "prepare_notes_push",
        req: buildRequest(),
        now: start + i,
      });
      if (res === null) {
        allowedCount++;
      } else if (firstRejectionIndex === -1) {
        firstRejectionIndex = i;
      }
    }

    expect(allowedCount).toBe(6);
    expect(firstRejectionIndex).toBe(6);
  });

  it("enforces the start_recording tier at 2/minute", async () => {
    const start = 1_700_000_000_000;
    let allowedCount = 0;
    let firstRejectionIndex = -1;

    for (let i = 0; i < 5; i++) {
      const res = await applyRateLimit({
        userId: "user_rec",
        clientId: "client_rec",
        tool: "start_recording",
        req: buildRequest(),
        now: start + i,
      });
      if (res === null) {
        allowedCount++;
      } else if (firstRejectionIndex === -1) {
        firstRejectionIndex = i;
      }
    }

    expect(allowedCount).toBe(2);
    expect(firstRejectionIndex).toBe(2);
  });

  it("frees capacity once the sliding window expires", async () => {
    const start = 1_700_000_000_000;

    // Fill the per-client minute bucket for read tools.
    for (let i = 0; i < 60; i++) {
      const res = await applyRateLimit({
        userId: "user_window",
        clientId: "client_window",
        tool: "get_meeting",
        req: buildRequest(),
        now: start + i,
      });
      expect(res).toBeNull();
    }

    // Still inside the window -> blocked.
    const blocked = await applyRateLimit({
      userId: "user_window",
      clientId: "client_window",
      tool: "get_meeting",
      req: buildRequest(),
      now: start + 30 * 1000,
    });
    expect(blocked?.status).toBe(429);

    // Move past the 60s window for ALL prior entries -> allowed again.
    const allowed = await applyRateLimit({
      userId: "user_window",
      clientId: "client_window",
      tool: "get_meeting",
      req: buildRequest(),
      now: start + 60 * 1000 + 100,
    });
    expect(allowed).toBeNull();
  });

  it("respects MCP_RATE_LIMIT_BYPASS_USER_IDS", async () => {
    process.env.MCP_RATE_LIMIT_BYPASS_USER_IDS = "user_bypass,user_other";
    const start = 1_700_000_000_000;

    for (let i = 0; i < 200; i++) {
      const res = await applyRateLimit({
        userId: "user_bypass",
        clientId: "client_bypass",
        tool: "start_recording",
        req: buildRequest(),
        now: start + i,
      });
      expect(res).toBeNull();
    }
  });

  it("enforces the per-user / hour tier at 600 across all tools", async () => {
    process.env.MCP_RATE_LIMIT_READ_PER_MIN = "10000"; // remove minute-tier interference
    const start = 1_700_000_000_000;
    let firstHourBlock = -1;

    for (let i = 0; i < 700; i++) {
      const res = await applyRateLimit({
        userId: "user_hourly",
        clientId: `client_${i % 50}`, // distribute clients to avoid client-tier
        tool: "search_meetings",
        req: buildRequest(),
        // Spread across ~50 minutes so per-minute tier never fires.
        now: start + i * 4000,
      });
      if (res !== null && firstHourBlock === -1) {
        firstHourBlock = i;
        const body = (await res.json()) as {
          error: { details?: { tier?: string } };
        };
        expect(body.error.details?.tier).toBe("user_hour");
        break;
      }
    }

    expect(firstHourBlock).toBe(600);
  });

  it("honors env overrides", async () => {
    process.env.MCP_RATE_LIMIT_READ_PER_MIN = "3";
    const start = 1_700_000_000_000;
    let allowedCount = 0;

    for (let i = 0; i < 10; i++) {
      const res = await applyRateLimit({
        userId: "user_env",
        clientId: "client_env",
        tool: "list_meetings",
        req: buildRequest(),
        now: start + i,
      });
      if (res === null) allowedCount++;
    }

    expect(allowedCount).toBe(3);
  });
});
