import { DeepgramClient } from "@deepgram/sdk";

let instance: DeepgramClient | null = null;
let instanceApiKey: string | null = null;
let streamingTokenScopeCheck: {
  apiKey: string;
  promise: Promise<void>;
} | null = null;
type Env = Record<string, string | undefined>;

export class DeepgramConfigurationError extends Error {
  code = "missing_deepgram_api_key";

  constructor() {
    super("DEEPGRAM_API_KEY is required for Deepgram transcription");
    this.name = "DeepgramConfigurationError";
  }
}

export class DeepgramStreamingTokenScopeError extends Error {
  code = "deepgram_streaming_token_scope_insufficient";

  constructor(options?: { cause?: unknown }) {
    super("DEEPGRAM_API_KEY scope insufficient");
    this.name = "DeepgramStreamingTokenScopeError";
    this.cause = options?.cause;
  }
}

export function isDeepgramPermissionError(error: unknown): boolean {
  if (error instanceof DeepgramStreamingTokenScopeError) return true;
  if (typeof error !== "object" || error === null) return false;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    body?: { err_code?: unknown; err_msg?: unknown };
    response?: {
      status?: unknown;
      data?: { err_code?: unknown; err_msg?: unknown };
    };
    message?: unknown;
  };

  const statusCode = Number(
    record.statusCode ?? record.status ?? record.response?.status,
  );
  const errCode =
    typeof record.body?.err_code === "string"
      ? record.body.err_code
      : typeof record.response?.data?.err_code === "string"
        ? record.response.data.err_code
        : "";
  const errMsg =
    typeof record.body?.err_msg === "string"
      ? record.body.err_msg
      : typeof record.response?.data?.err_msg === "string"
        ? record.response.data.err_msg
        : "";
  const message = typeof record.message === "string" ? record.message : "";

  return (
    statusCode === 403 ||
    errCode.toLowerCase() === "forbidden" ||
    /insufficient permissions/i.test(errMsg) ||
    /insufficient permissions/i.test(message)
  );
}

export function getDeepgramApiKey(
  env: Env = process.env as Env,
): string | null {
  const apiKey = env.DEEPGRAM_API_KEY?.trim();
  return apiKey || null;
}

export function getDeepgramClient(): DeepgramClient | null {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) return null;

  if (instance && instanceApiKey === apiKey) return instance;

  instance = new DeepgramClient({ apiKey });
  instanceApiKey = apiKey;
  return instance;
}

export function requireDeepgramClient(): DeepgramClient {
  const client = getDeepgramClient();
  if (!client) throw new DeepgramConfigurationError();
  return client;
}

export async function createDeepgramStreamingToken(
  ttlSeconds = 600,
): Promise<{ token: string; expiresAt: number }> {
  const response = await requireDeepgramClient().auth.v1.tokens.grant({
    ttl_seconds: ttlSeconds,
  });
  const token = response.access_token?.trim();

  if (!token) {
    throw new Error("Deepgram did not return a streaming access token");
  }

  return {
    token,
    expiresAt: Date.now() + (response.expires_in ?? ttlSeconds) * 1000,
  };
}

export async function assertDeepgramStreamingTokenScope(): Promise<void> {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) throw new DeepgramConfigurationError();

  if (streamingTokenScopeCheck?.apiKey === apiKey) {
    return streamingTokenScopeCheck.promise;
  }

  streamingTokenScopeCheck = {
    apiKey,
    promise: requireDeepgramClient()
      .auth.v1.tokens.grant({ ttl_seconds: 1 })
      .then((response) => {
        if (!response.access_token?.trim()) {
          throw new Error("Deepgram did not return a streaming access token");
        }
      })
      .catch((error: unknown) => {
        if (isDeepgramPermissionError(error)) {
          throw new DeepgramStreamingTokenScopeError({ cause: error });
        }
        if (streamingTokenScopeCheck?.apiKey === apiKey) {
          streamingTokenScopeCheck = null;
        }
        throw error;
      }),
  };

  return streamingTokenScopeCheck.promise;
}

export function __resetDeepgramClientForTests(): void {
  instance = null;
  instanceApiKey = null;
  streamingTokenScopeCheck = null;
}
