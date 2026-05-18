/**
 * Structured error codes for MCP and OAuth surfaces.
 *
 * Every API error returned by app/api/mcp/** and app/api/oauth/** should map
 * to one of these codes. The `respondWithError` helper translates codes to
 * HTTP status, response body, and structured log lines.
 */

export const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  RATE_LIMITED: "rate_limited",
  CLIENT_REVOKED: "client_revoked",
  VALIDATION_ERROR: "validation_error",
  VENDOR_UNAVAILABLE: "vendor_unavailable",
  INTERNAL_ERROR: "internal_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Code -> HTTP status. Anything not in the map falls back to 500.
 */
export const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.CLIENT_REVOKED]: 401,
  [ERROR_CODES.VENDOR_UNAVAILABLE]: 502,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
};

/**
 * Codes considered retryable by the client.
 */
export const RETRYABLE_CODES = new Set<ErrorCode>([
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.VENDOR_UNAVAILABLE,
  ERROR_CODES.INTERNAL_ERROR,
]);

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

/**
 * Public docs URL for a code. Surfaced inside error bodies so clients can
 * deep-link into operator docs without us hard-coding magic strings.
 */
export function docsUrlForCode(code: ErrorCode): string {
  return `https://layers.mirrorfactory.ai/docs/errors#${code}`;
}
