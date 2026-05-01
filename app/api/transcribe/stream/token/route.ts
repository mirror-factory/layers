export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { withExternalCall } from "@/lib/with-external";
import { getAssemblyAI } from "@/lib/assemblyai/client";
import { checkQuota } from "@/lib/billing/quota";
import {
  buildDeepgramListenUrl,
  getDeepgramStreamingConfig,
} from "@/lib/deepgram/options";
import {
  createDeepgramStreamingToken,
  getDeepgramClient,
} from "@/lib/deepgram/client";
import { getMeetingsStore } from "@/lib/meetings/store";
import { cleanRecordingTitle } from "@/lib/recording/meeting-context";
import {
  providerEnvVarName,
  resolveRuntimeStreamingOption,
  runtimeProviderForOption,
} from "@/lib/recording/transcription-provider";
import { getSettings } from "@/lib/settings";

const STREAMING_TOKEN_TTL_SECONDS = 600;

async function readOptionalJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function missingProviderResponse(provider: "assemblyai" | "deepgram") {
  const envVar = providerEnvVarName(provider);
  const label = provider === "deepgram" ? "Deepgram" : "AssemblyAI";
  return NextResponse.json(
    {
      error: `${envVar} is required for ${label} streaming transcription`,
      code: "missing_stt_api_key",
      provider,
      envVar,
    },
    { status: 502 },
  );
}

function isDeepgramPermissionError(error: unknown): boolean {
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

function streamingTokenFailureResponse(
  provider: "assemblyai" | "deepgram",
  error: unknown,
) {
  if (provider === "deepgram" && isDeepgramPermissionError(error)) {
    return NextResponse.json(
      {
        error:
          "Deepgram API key cannot create temporary streaming tokens. Use a Deepgram key with Member or higher authorization, or switch the streaming model back to AssemblyAI in Settings.",
        code: "stt_token_permission_denied",
        provider,
        envVar: "DEEPGRAM_API_KEY",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      error: "Unable to create streaming token",
      code: "stt_token_create_failed",
      provider,
    },
    { status: 502 },
  );
}

function buildAssemblyAiListenUrl(opts: {
  token: string;
  sampleRate: number;
  speechModel: string;
}): string {
  const url = new URL("wss://streaming.assemblyai.com/v3/ws");
  url.searchParams.set("sample_rate", String(opts.sampleRate));
  url.searchParams.set("token", opts.token);
  url.searchParams.set("speech_model", opts.speechModel);
  url.searchParams.set("speaker_labels", "true");
  url.searchParams.set("format_turns", "true");
  return url.toString();
}

export const POST = withRoute(async (req, ctx) => {
  const body = await readOptionalJson(req);
  const meetingTitle = cleanRecordingTitle(
    typeof body === "object" && body !== null
      ? (body as { meetingTitle?: unknown }).meetingTitle
      : null,
  );

  // Quota check
  const quota = await checkQuota();
  if (!quota.allowed) {
    const limitCopy = quota.reason === "minute_limit"
      ? `${quota.planId} plan minute limit reached (${quota.monthlyMinutesUsed}/${quota.minuteLimit} min this month).`
      : `${quota.planId} plan meeting limit reached (${quota.meetingCount}/${quota.meetingLimit} meetings).`;
    return NextResponse.json(
      {
        error: `${limitCopy} Upgrade to continue.`,
        code: "free_limit_reached",
        upgradeUrl: "/pricing",
      },
      { status: 402 },
    );
  }

  const settings = await getSettings();
  const speechOption = resolveRuntimeStreamingOption(settings);
  const provider = runtimeProviderForOption(speechOption);
  const speechModel = speechOption.model;
  const sampleRate = 16000;

  const assemblyAiClient = provider === "assemblyai" ? getAssemblyAI() : null;
  if (provider === "assemblyai" && !assemblyAiClient) {
    return missingProviderResponse(provider);
  }

  if (provider === "deepgram" && !getDeepgramClient()) {
    return missingProviderResponse(provider);
  }

  const deepgramConfig =
    provider === "deepgram" ? getDeepgramStreamingConfig(speechModel) : null;
  if (provider === "deepgram" && !deepgramConfig) {
    return NextResponse.json(
      {
        error: `Deepgram streaming model "${speechModel}" is not implemented`,
        code: "unsupported_stt_model",
        provider,
      },
      { status: 400 },
    );
  }

  // Create the meeting row before minting a paid vendor token. If persistence
  // is unavailable, fail before creating an external session the app cannot save.
  const meetingId = crypto.randomUUID();
  const store = await getMeetingsStore();
  try {
    await store.insert({
      id: meetingId,
      status: "processing",
      title: meetingTitle,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to create meeting before streaming" },
      { status: 503 },
    );
  }

  if (provider === "assemblyai") {
    let token: string;
    try {
      token = await withExternalCall(
        {
          vendor: "assemblyai",
          operation: "streaming.createTemporaryToken",
          requestId: ctx.requestId,
        },
        () =>
          assemblyAiClient!.streaming.createTemporaryToken({
            expires_in_seconds: STREAMING_TOKEN_TTL_SECONDS,
          }),
      );
    } catch (error) {
      await store.update(meetingId, {
        status: "error",
        error: "Unable to create streaming token",
      }).catch(() => null);
      return streamingTokenFailureResponse(provider, error);
    }

    return NextResponse.json({
      provider,
      token,
      meetingId,
      expiresAt: Date.now() + STREAMING_TOKEN_TTL_SECONDS * 1000,
      sampleRate,
      speechModel,
      wsUrl: buildAssemblyAiListenUrl({ token, sampleRate, speechModel }),
    });
  }

  let deepgramToken: { token: string; expiresAt: number };
  try {
    deepgramToken = await withExternalCall(
      {
        vendor: "deepgram",
        operation: "auth.tokens.grant",
        requestId: ctx.requestId,
      },
      () => createDeepgramStreamingToken(STREAMING_TOKEN_TTL_SECONDS),
    );
  } catch (error) {
    await store.update(meetingId, {
      status: "error",
      error: "Unable to create streaming token",
    }).catch(() => null);
    return streamingTokenFailureResponse(provider, error);
  }

  return NextResponse.json({
    provider,
    token: deepgramToken.token,
    meetingId,
    expiresAt: deepgramToken.expiresAt,
    sampleRate: deepgramConfig!.sampleRate,
    speechModel,
    listenVersion: deepgramConfig!.listenVersion,
    wsUrl: buildDeepgramListenUrl(deepgramConfig!),
    protocols: ["bearer", deepgramToken.token],
  });
});
