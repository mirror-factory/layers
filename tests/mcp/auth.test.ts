import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { validateMcpBearerToken } from "@/lib/mcp/auth";
import { MCP_OAUTH_AUDIENCE, MCP_OAUTH_ISSUER } from "@/lib/oauth/mcp-oauth";

const testSecret = new TextEncoder().encode(
  process.env.MCP_JWT_SECRET ??
    process.env.SUPABASE_JWT_SECRET ??
    "mcp-fallback-secret-change-me",
);

async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setIssuer(MCP_OAUTH_ISSUER)
    .setAudience(MCP_OAUTH_AUDIENCE)
    .sign(testSecret);
}

describe("MCP bearer auth", () => {
  it("accepts OAuth access tokens with mcp:tools scope", async () => {
    const token = await signToken({ sub: "user_123", scope: "mcp:tools" });

    // PROD-403: the result now carries an optional `clientId` claim. Tokens
    // without a `client_id` (legacy + tests like this one) get null.
    await expect(validateMcpBearerToken(token)).resolves.toEqual({
      userId: "user_123",
      clientId: null,
    });
  });

  it("propagates the client_id claim when present (PROD-403)", async () => {
    const token = await signToken({
      sub: "user_456",
      scope: "mcp:tools",
      client_id: "mcp-abc-123",
    });

    await expect(validateMcpBearerToken(token)).resolves.toEqual({
      userId: "user_456",
      clientId: "mcp-abc-123",
    });
  });

  it("rejects OAuth access tokens without mcp:tools scope", async () => {
    const token = await signToken({ sub: "user_123", scope: "profile" });

    await expect(validateMcpBearerToken(token)).resolves.toBeNull();
  });

  it("rejects malformed bearer tokens", async () => {
    await expect(validateMcpBearerToken("short")).resolves.toBeNull();
  });
});
