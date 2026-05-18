/**
 * respondWithError -- canonical error response helper for MCP + OAuth routes.
 *
 * Returns a Response (not NextResponse — keeps it usable from non-Next route
 * handlers like the MCP transport handler). Every error body has the same
 * shape:
 *
 *   {
 *     "error": {
 *       "code": "rate_limited",
 *       "message": "Too many requests",
 *       "retryable": true,
 *       "retry_after_seconds": 47,
 *       "request_id": "req_…",
 *       "docs_url": "https://layers.mirrorfactory.ai/docs/errors#rate_limited"
 *     }
 *   }
 *
 * Also emits a structured `route.error` log line so failures stay visible
 * in the stdout sink even when Langfuse / Supabase are unconfigured.
 */

import { log } from "@/lib/logger";
import {
  docsUrlForCode,
  ERROR_CODE_TO_STATUS,
  isRetryable,
  type ErrorCode,
} from "./codes";

export interface RespondWithErrorExtras {
  /** Seconds the client should wait before retrying. Sets Retry-After header. */
  retryAfterSeconds?: number;
  /** Override the request id (default: x-request-id header or a generated id). */
  requestId?: string;
  /** Extra fields merged onto the error body for debugging context. */
  details?: Record<string, unknown>;
  /** Extra response headers (e.g. WWW-Authenticate for 401). */
  headers?: Record<string, string>;
  /** Override the auto-derived HTTP status. */
  status?: number;
}

export interface StructuredErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    retry_after_seconds?: number;
    request_id: string;
    docs_url: string;
    details?: Record<string, unknown>;
  };
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readRequestId(req: Request | null | undefined): string {
  if (!req) return generateRequestId();
  return req.headers.get("x-request-id") ?? generateRequestId();
}

function readPath(req: Request | null | undefined): string | undefined {
  if (!req) return undefined;
  try {
    return new URL(req.url).pathname;
  } catch {
    return undefined;
  }
}

/**
 * Canonical structured error response.
 */
export function respondWithError(
  req: Request | null | undefined,
  code: ErrorCode,
  message: string,
  extras: RespondWithErrorExtras = {},
): Response {
  const status = extras.status ?? ERROR_CODE_TO_STATUS[code] ?? 500;
  const requestId = extras.requestId ?? readRequestId(req);
  const retryable = isRetryable(code);
  const path = readPath(req);
  const method = req?.method;

  const body: StructuredErrorBody = {
    error: {
      code,
      message,
      retryable,
      request_id: requestId,
      docs_url: docsUrlForCode(code),
    },
  };

  if (typeof extras.retryAfterSeconds === "number" && extras.retryAfterSeconds > 0) {
    body.error.retry_after_seconds = Math.ceil(extras.retryAfterSeconds);
  }

  if (extras.details && Object.keys(extras.details).length > 0) {
    body.error.details = extras.details;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "x-request-id": requestId,
    ...(extras.headers ?? {}),
  };

  if (typeof extras.retryAfterSeconds === "number" && extras.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(Math.ceil(extras.retryAfterSeconds));
  }

  log.error("route.error", {
    requestId,
    method,
    path,
    status,
    code,
    message,
    retryable,
    retryAfterSeconds: body.error.retry_after_seconds,
  });

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
