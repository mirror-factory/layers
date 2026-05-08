import { DeepgramClient } from "@deepgram/sdk";

let instance: DeepgramClient | null = null;
let instanceApiKey: string | null = null;
type Env = Record<string, string | undefined>;

export class DeepgramConfigurationError extends Error {
  code = "missing_deepgram_api_key";

  constructor() {
    super("DEEPGRAM_API_KEY is required for Deepgram transcription");
    this.name = "DeepgramConfigurationError";
  }
}

export class DeepgramScopeError extends Error {
  code = "deepgram_api_key_scope_insufficient";

  constructor() {
    super("DEEPGRAM_API_KEY scope insufficient");
    this.name = "DeepgramScopeError";
  }
}

let streamingTokenScopeCheck:
  | { apiKey: string; promise: Promise<void> }
  | null = null;

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

export function isDeepgramPermissionError(error: unknown): boolean {
  if (error instanceof DeepgramScopeError) return true;
  if (typeof error !== "object" || error === null) return false;
  const record = error as {
    statusCode?: unknown;
    body?: { err_code?: unknown; err_msg?: unknown };
    message?: unknown;
  };

  const statusCode = Number(record.statusCode);
  const errCode =
    typeof record.body?.err_code === "string" ? record.body.err_code : "";
  const errMsg =
    typeof record.body?.err_msg === "string" ? record.body.err_msg : "";
  const message = typeof record.message === "string" ? record.message : "";

  return (
    statusCode === 403 ||
    errCode.toLowerCase() === "forbidden" ||
    /insufficient permissions/i.test(errMsg) ||
    /insufficient permissions/i.test(message)
  );
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

  const promise = createDeepgramStreamingToken(1)
    .then(() => undefined)
    .catch((error: unknown) => {
      if (isDeepgramPermissionError(error)) {
        throw new DeepgramScopeError();
      }
      throw error;
    });

  streamingTokenScopeCheck = { apiKey, promise };
  return promise;
}
