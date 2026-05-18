export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591).
 *
 * MCP clients like Claude Desktop, Cursor, and Continue look for
 * `registration_endpoint` in the authorization-server metadata so they
 * can register themselves before starting OAuth. Without this endpoint
 * those clients silently fail and never open the auth window.
 *
 * We accept any well-formed registration request whose redirect URIs
 * pass our allow-list (claude://, localhost, 127.0.0.1, anthropic.com,
 * cursor://). We don't persist anything — the issued `client_id` is a
 * stateless identifier; real security comes from PKCE on the authorize
 * + token steps and from the redirect-URI allow-list re-checked there.
 */

interface RegisterRequest {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  scope?: unknown;
  application_type?: unknown;
}

const REDIRECT_URI_ALLOW_LIST: RegExp[] = [
  // Desktop clients spinning up loopback servers
  /^https?:\/\/localhost(:\d+)?(\/[^\s]*)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?(\/[^\s]*)?$/,
  /^https?:\/\/\[::1\](:\d+)?(\/[^\s]*)?$/,
  // Native app schemes
  /^claude:\/\/[^\s]*$/i,
  /^cursor:\/\/[^\s]*$/i,
  /^continue:\/\/[^\s]*$/i,
  // Vendor-hosted callbacks
  /^https:\/\/(?:[a-z0-9-]+\.)*anthropic\.com\/[^\s]*$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)*claude\.ai\/[^\s]*$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)*claude\.com\/[^\s]*$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)*cursor\.sh\/[^\s]*$/i,
];

function isAllowedRedirectUri(uri: string): boolean {
  return REDIRECT_URI_ALLOW_LIST.some((re) => re.test(uri));
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris must be a non-empty array.",
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !isAllowedRedirectUri(uri)) {
      return NextResponse.json(
        {
          error: "invalid_redirect_uri",
          error_description: `redirect_uri ${String(uri)} is not on the Layers allow-list. Allowed: localhost / 127.0.0.1 / claude:// / cursor:// / anthropic.com / claude.ai / claude.com / cursor.sh.`,
        },
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  const clientId = `mcp-${randomUUID()}`;
  const issuedAt = Math.floor(Date.now() / 1000);

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name:
        typeof body.client_name === "string" && body.client_name.trim()
          ? body.client_name.trim()
          : "MCP Client",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type:
        typeof body.application_type === "string" ? body.application_type : "native",
      scope: typeof body.scope === "string" ? body.scope : "mcp:tools",
    },
    {
      status: 201,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}
