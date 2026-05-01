/**
 * PROD-405 -- canonical structured error body shape.
 *
 * Locks down the wire contract every MCP / OAuth route uses for error
 * responses. If a future change accidentally ships a divergent shape this
 * suite is the first thing that goes red.
 */

import { describe, expect, it } from "vitest";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors/codes";
import { respondWithError } from "@/lib/errors/respond";

function buildRequest(
  init: Partial<{ requestId: string; method: string; url: string }> = {},
): Request {
  const headers = new Headers();
  if (init.requestId) headers.set("x-request-id", init.requestId);
  return new Request(init.url ?? "http://localhost/api/mcp/test", {
    method: init.method ?? "POST",
    headers,
  });
}

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    request_id: string;
    docs_url: string;
    retry_after_seconds?: number;
    details?: Record<string, unknown>;
  };
}

describe("lib/errors/respond -- structured error responses", () => {
  it.each<{ code: ErrorCode; status: number; retryable: boolean }>([
    { code: ERROR_CODES.VALIDATION_ERROR, status: 400, retryable: false },
    { code: ERROR_CODES.UNAUTHORIZED, status: 401, retryable: false },
    { code: ERROR_CODES.FORBIDDEN, status: 403, retryable: false },
    { code: ERROR_CODES.NOT_FOUND, status: 404, retryable: false },
    { code: ERROR_CODES.RATE_LIMITED, status: 429, retryable: true },
    { code: ERROR_CODES.CLIENT_REVOKED, status: 401, retryable: false },
    { code: ERROR_CODES.VENDOR_UNAVAILABLE, status: 502, retryable: true },
    { code: ERROR_CODES.INTERNAL_ERROR, status: 500, retryable: true },
  ])(
    "$code -> HTTP $status with retryable=$retryable",
    async ({ code, status, retryable }) => {
      const res = respondWithError(buildRequest(), code, "boom");
      expect(res.status).toBe(status);
      const body = (await res.json()) as ErrorEnvelope;
      expect(body.error.code).toBe(code);
      expect(body.error.retryable).toBe(retryable);
      expect(body.error.message).toBe("boom");
      expect(body.error.docs_url).toBe(
        `https://layers.mirrorfactory.ai/docs/errors#${code}`,
      );
      expect(typeof body.error.request_id).toBe("string");
      expect(body.error.request_id).toMatch(/^req_/);
    },
  );

  it("threads x-request-id from the inbound request and echoes it on the response", async () => {
    const req = buildRequest({ requestId: "req_in_405" });
    const res = respondWithError(req, ERROR_CODES.UNAUTHORIZED, "no token");
    const body = (await res.json()) as ErrorEnvelope;

    expect(body.error.request_id).toBe("req_in_405");
    expect(res.headers.get("x-request-id")).toBe("req_in_405");
  });

  it("generates a request id when none is supplied", async () => {
    const res = respondWithError(buildRequest(), ERROR_CODES.NOT_FOUND, "404");
    const body = (await res.json()) as ErrorEnvelope;

    expect(body.error.request_id).toMatch(/^req_/);
    expect(res.headers.get("x-request-id")).toBe(body.error.request_id);
  });

  it("sets Retry-After header and retry_after_seconds for RATE_LIMITED", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.RATE_LIMITED,
      "slow down",
      { retryAfterSeconds: 47 },
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("47");
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.retry_after_seconds).toBe(47);
    expect(body.error.retryable).toBe(true);
  });

  it("rounds fractional retry_after_seconds up", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.RATE_LIMITED,
      "slow down",
      { retryAfterSeconds: 12.3 },
    );
    expect(res.headers.get("Retry-After")).toBe("13");
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.retry_after_seconds).toBe(13);
  });

  it("merges custom headers (e.g. WWW-Authenticate)", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.UNAUTHORIZED,
      "no token",
      {
        headers: {
          "WWW-Authenticate": 'Bearer resource_metadata="https://x/.well-known"',
        },
      },
    );
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="https://x/.well-known"',
    );
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("attaches optional details onto the error body", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.VALIDATION_ERROR,
      "bad input",
      { details: { field: "limit", reason: "exceeds_max" } },
    );
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.details).toEqual({ field: "limit", reason: "exceeds_max" });
  });

  it("omits retry_after_seconds when not provided", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.NOT_FOUND,
      "missing",
    );
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.retry_after_seconds).toBeUndefined();
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("always sets Cache-Control: no-store", async () => {
    const res = respondWithError(buildRequest(), ERROR_CODES.INTERNAL_ERROR, "boom");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("supports a status override (e.g. CLIENT_REVOKED -> 403)", async () => {
    const res = respondWithError(
      buildRequest(),
      ERROR_CODES.CLIENT_REVOKED,
      "client revoked",
      { status: 403 },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe("client_revoked");
  });
});
