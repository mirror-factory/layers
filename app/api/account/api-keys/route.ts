/**
 * PROD-403: personal-access-token (PAT) lifecycle.
 *
 * The default integration path is OAuth + Dynamic Client Registration --
 * MCP clients should never need a hand-pasted bearer. This endpoint is
 * scaffolded for the explicit power-user case: a server-to-server script
 * that can't run a browser to complete OAuth.
 *
 * Plaintext is shown EXACTLY ONCE on `POST`. We persist only the SHA-256
 * hash (`token_hash`) and a 12-char prefix (`token_prefix`) for the UI's
 * "layers_pat_abcd…" display. There is no way to recover a lost PAT --
 * the user has to revoke and reissue.
 *
 * Token validation against PATs is wired in `lib/mcp/auth.ts` in a follow-up
 * (this ticket only ships the lifecycle endpoints + UI; the validator
 * path that consumes `api_keys` is deferred as documented on PROD-403).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";

const PAT_PREFIX = "layers_pat_";

interface ApiKeyRow {
  id: string;
  name: string | null;
  token_prefix: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ApiKeySummary {
  id: string;
  name: string | null;
  tokenPrefix: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scope: row.scope,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mintPat(): { plaintext: string; prefix: string } {
  // 32 bytes of entropy -> 43-char base64url. Plenty for a bearer that
  // also goes through HTTPS + per-route rate limiting.
  const body = randomBytes(32).toString("base64url");
  const plaintext = `${PAT_PREFIX}${body}`;
  // Prefix shown in the UI is the leading 16 chars so the user can
  // identify which key they revoked from a list, without ever exposing
  // enough material to authenticate as them.
  const prefix = plaintext.slice(0, PAT_PREFIX.length + 4);
  return { plaintext, prefix };
}

export const GET = withRoute(async () => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, token_prefix, scope, created_at, last_used_at, revoked_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ keys: [] });
  }

  const keys = (data ?? []).map((row) => toSummary(row as ApiKeyRow));
  return NextResponse.json({ keys });
});

export const POST = withRoute(async (req) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    body = {};
  }

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim().slice(0, 80)
      : null;

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { plaintext, prefix } = mintPat();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      token_hash: hashToken(plaintext),
      token_prefix: prefix,
      scope: "mcp:tools",
    })
    .select(
      "id, name, token_prefix, scope, created_at, last_used_at, revoked_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to mint API key" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    key: toSummary(data as ApiKeyRow),
    // Plaintext returned EXACTLY ONCE. The client must show this to
    // the user and warn them to copy it now -- we can't show it again.
    plaintext,
  });
});
