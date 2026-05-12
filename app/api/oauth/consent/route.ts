export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseUser } from "@/lib/supabase/user";
import {
  appendOAuthCode,
  appendOAuthError,
  parseOAuthAuthorizeParams,
} from "@/lib/oauth/mcp-oauth";
import { upsertOauthClient } from "@/lib/oauth/clients";
import { respondWithError } from "@/lib/errors/respond";
import { ERROR_CODES } from "@/lib/errors/codes";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Expected form data" },
      { status: 400 },
    );
  }

  const decision = form.get("decision");
  const searchParams = new URLSearchParams();

  for (const [key, value] of form.entries()) {
    if (key !== "decision" && typeof value === "string") {
      searchParams.append(key, value);
    }
  }

  const parsed = parseOAuthAuthorizeParams(searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: parsed.error.error,
        error_description: parsed.error.errorDescription,
      },
      { status: parsed.error.status },
    );
  }

  if (decision !== "allow") {
    // 303 See Other forces the OAuth callback to be hit as GET regardless
    // of the original POST. Default 307 would preserve POST and trigger
    // "Method Not Allowed" on the upstream client (e.g., claude.ai).
    return NextResponse.redirect(
      appendOAuthError(
        parsed.value.redirectUri,
        parsed.value.state,
        "access_denied",
        "The user denied Layers MCP access.",
      ),
      303,
    );
  }

  const userSupabase = await getSupabaseUser();
  if (!userSupabase) {
    return respondWithError(
      req,
      ERROR_CODES.VENDOR_UNAVAILABLE,
      "Auth provider not configured",
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return respondWithError(req, ERROR_CODES.UNAUTHORIZED, "Not authenticated");
  }

  const serviceSupabase = getSupabaseServer();
  if (!serviceSupabase) {
    return respondWithError(
      req,
      ERROR_CODES.VENDOR_UNAVAILABLE,
      "Database not configured",
      { status: 503 },
    );
  }

  const code = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await serviceSupabase.from("oauth_codes").insert({
    client_id: parsed.value.clientId,
    code,
    code_challenge: parsed.value.codeChallenge,
    code_challenge_method: parsed.value.codeChallengeMethod,
    expires_at: expiresAt,
    redirect_uri: parsed.value.redirectUri,
    scope: parsed.value.scope,
    user_id: user.id,
  });

  if (error) {
    return respondWithError(
      req,
      ERROR_CODES.INTERNAL_ERROR,
      "Failed to create authorization code",
    );
  }

  // PROD-403: persist the OAuth client on FIRST successful authorization.
  // We deliberately do not write on register POST -- thousands of MCP clients
  // register and abandon the flow. Reaching consent + decision="allow" is
  // the strongest signal that this user actually wants this client.
  if (parsed.value.clientId) {
    const clientName = readClientName(form);
    await upsertOauthClient(serviceSupabase, {
      userId: user.id,
      clientId: parsed.value.clientId,
      clientName,
      redirectUris: [parsed.value.redirectUri],
    });
  }

  // 303 See Other — the consent page POSTs here, but the upstream OAuth
  // callback (claude.ai/api/mcp/auth_callback, etc.) only accepts GET.
  // The default 307 preserves the POST method and triggers "Method Not
  // Allowed" on the client. 303 explicitly switches the redirect to GET.
  return NextResponse.redirect(
    appendOAuthCode(parsed.value.redirectUri, code, parsed.value.state),
    303,
  );
}

function readClientName(form: FormData): string | null {
  // The consent screen passes through the `client_name` we got from the
  // register call so the persisted row shows the human label the user
  // saw on the approval screen (e.g. "Claude Desktop", "Cursor").
  const raw = form.get("client_name");
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
