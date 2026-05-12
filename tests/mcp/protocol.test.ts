import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const validateMcpBearerToken = vi.fn();
  const validateMcpBearerOutcome = vi.fn();
  const registeredTools: string[] = [];
  const registeredResources: Array<{ name: string; uri: string }> = [];
  const createMcpHandler = vi.fn((configure: (server: {
    tool: ReturnType<typeof vi.fn>;
    registerTool: ReturnType<typeof vi.fn>;
    registerResource: ReturnType<typeof vi.fn>;
  }) => void) => {
    const tool = vi.fn((name: string) => {
      registeredTools.push(name);
    });
    const registerTool = vi.fn((name: string) => {
      registeredTools.push(name);
    });
    const registerResource = vi.fn((name: string, uri: string) => {
      registeredResources.push({ name, uri });
    });
    configure({ tool, registerTool, registerResource });
    return async () =>
      new Response(JSON.stringify({ forwarded: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
  });

  return {
    createMcpHandler,
    registeredResources,
    registeredTools,
    validateMcpBearerToken,
    validateMcpBearerOutcome,
  };
});

vi.mock("mcp-handler", () => ({
  createMcpHandler: mocks.createMcpHandler,
}));

vi.mock("@/lib/mcp/auth", () => ({
  validateMcpBearerToken: mocks.validateMcpBearerToken,
  validateMcpBearerOutcome: mocks.validateMcpBearerOutcome,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/embeddings/search", () => ({
  searchMeetings: vi.fn(),
}));

const { GET, POST, DELETE } = await import("@/app/api/mcp/[transport]/route");

function jsonRequest(method: string, body?: unknown, authorization?: string): Request {
  return new Request("http://localhost:3000/api/mcp/mcp", {
    method,
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("MCP route protocol auth", () => {
  beforeEach(() => {
    mocks.createMcpHandler.mockClear();
    mocks.registeredTools.length = 0;
    mocks.registeredResources.length = 0;
    mocks.validateMcpBearerToken.mockReset();
    mocks.validateMcpBearerOutcome.mockReset();
  });

  it("allows initialize without bearer auth", async () => {
    const res = await POST(jsonRequest("POST", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ forwarded: true });
    expect(mocks.validateMcpBearerOutcome).not.toHaveBeenCalled();
  });

  it("registers every public MCP tool on the route", async () => {
    await POST(jsonRequest("POST", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));

    expect(mocks.registeredTools).toEqual([
      "search_meetings",
      "get_meeting",
      "list_meetings",
      "get_transcript",
      "get_summary",
      "start_recording",
      "prepare_notes_push",
      "show_meeting_dashboard",
    ]);
  });

  it("registers the Claude MCP App dashboard resource", async () => {
    await POST(jsonRequest("POST", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));

    expect(mocks.registeredResources).toEqual([
      {
        name: "Layers Meeting Dashboard",
        uri: "ui://layers/meeting-dashboard.html",
      },
    ]);
  });

  it("allows notifications without bearer auth", async () => {
    const res = await POST(jsonRequest("POST", { jsonrpc: "2.0", method: "notifications/initialized" }));

    expect(res.status).toBe(200);
    expect(mocks.validateMcpBearerOutcome).not.toHaveBeenCalled();
  });

  it("allows DELETE protocol cleanup without bearer auth", async () => {
    const res = await DELETE(jsonRequest("DELETE"));

    expect(res.status).toBe(200);
    expect(mocks.validateMcpBearerOutcome).not.toHaveBeenCalled();
  });

  it("requires bearer auth for tools/list", async () => {
    const res = await POST(jsonRequest("POST", { jsonrpc: "2.0", id: 2, method: "tools/list" }));

    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(res.headers.get("www-authenticate")).toContain("http://localhost:3000/.well-known/oauth-protected-resource");
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("rejects invalid bearer auth", async () => {
    mocks.validateMcpBearerOutcome.mockResolvedValue({ kind: "invalid" });

    const res = await POST(
      jsonRequest("POST", { jsonrpc: "2.0", id: 3, method: "tools/list" }, "Bearer bad_key_123456789"),
    );

    expect(res.status).toBe(401);
    expect(mocks.validateMcpBearerOutcome).toHaveBeenCalledWith("bad_key_123456789");
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("rejects revoked client with a distinguishable client_revoked error", async () => {
    // PROD-403: a user-revoked OAuth client must surface as `client_revoked`
    // so MCP clients (Claude / Cursor) can show "you revoked this app" to
    // the user instead of an opaque "invalid token" reauth loop.
    mocks.validateMcpBearerOutcome.mockResolvedValue({ kind: "revoked" });

    const res = await POST(
      jsonRequest(
        "POST",
        { jsonrpc: "2.0", id: 5, method: "tools/list" },
        "Bearer revoked_token_aaaaaaaaaaa",
      ),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; error_description: string };
    expect(body.error).toBe("client_revoked");
    expect(body.error_description).toMatch(/revoked/i);
  });

  it("forwards valid bearer requests to a fresh MCP handler", async () => {
    mocks.validateMcpBearerOutcome.mockResolvedValue({
      kind: "ok",
      userId: "user_a",
      clientId: null,
    });

    const res = await POST(
      jsonRequest("POST", { jsonrpc: "2.0", id: 4, method: "tools/list" }, "Bearer valid_key_123456789"),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ forwarded: true });
    expect(mocks.createMcpHandler).toHaveBeenCalledTimes(1);
  });

  it("requires bearer auth for GET transport requests", async () => {
    const res = await GET(jsonRequest("GET"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });
});
