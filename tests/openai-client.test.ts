import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OpenAiConfigurationError,
  OpenAiTranscriptionError,
  __resetOpenAiClientForTests,
  getOpenAiApiKey,
  getOpenAiBaseUrl,
  getOpenAiClient,
  requireOpenAiClient,
  transcribeAudio,
  type OpenAiClient,
} from "@/lib/openai/client";
import {
  OPENAI_TRANSCRIPTION_MODELS,
  OPENAI_TRANSCRIPTION_MODEL_DESCRIPTORS,
  getOpenAiTranscriptionModelDescriptor,
  isOpenAiTranscriptionModel,
} from "@/lib/openai/models";

function makeOkResponse(body: unknown, init?: { isText?: boolean }): Response {
  if (init?.isText) {
    return new Response(typeof body === "string" ? body : String(body), {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeErrorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

describe("OpenAI client diagnostics", () => {
  beforeEach(() => {
    __resetOpenAiClientForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetOpenAiClientForTests();
  });

  it("returns null when OPENAI_API_KEY is missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(getOpenAiApiKey()).toBeNull();
    expect(getOpenAiClient()).toBeNull();
  });

  it("returns null when OPENAI_API_KEY is whitespace", () => {
    vi.stubEnv("OPENAI_API_KEY", "   ");
    expect(getOpenAiApiKey()).toBeNull();
  });

  it("returns a client when OPENAI_API_KEY is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-123");
    const client = getOpenAiClient();
    expect(client).not.toBeNull();
    expect(client?.apiKey).toBe("sk-test-123");
    expect(client?.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("honours OPENAI_BASE_URL when provided", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-123");
    vi.stubEnv("OPENAI_BASE_URL", "https://proxy.example.com/v1");
    expect(getOpenAiBaseUrl()).toBe("https://proxy.example.com/v1");
    const client = getOpenAiClient();
    expect(client?.baseUrl).toBe("https://proxy.example.com/v1");
  });

  it("requireOpenAiClient throws a typed error when the key is missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => requireOpenAiClient()).toThrow(OpenAiConfigurationError);
    expect(() => requireOpenAiClient()).toThrow(
      "OPENAI_API_KEY is required for OpenAI transcription",
    );
  });

  it("memoizes the client when the key has not changed", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-123");
    const a = getOpenAiClient();
    const b = getOpenAiClient();
    expect(a).toBe(b);
  });

  it("refreshes the cached client when the key rotates", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-first");
    const first = getOpenAiClient();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-second");
    const second = getOpenAiClient();
    expect(first?.apiKey).toBe("sk-test-first");
    expect(second?.apiKey).toBe("sk-test-second");
    expect(first).not.toBe(second);
  });
});

describe("OPENAI_TRANSCRIPTION_MODELS registry", () => {
  it("exposes whisper-1 + gpt-4o-(mini-)transcribe", () => {
    expect(OPENAI_TRANSCRIPTION_MODELS).toEqual([
      "whisper-1",
      "gpt-4o-mini-transcribe",
      "gpt-4o-transcribe",
    ]);
  });

  it("ships a descriptor for every supported model", () => {
    for (const model of OPENAI_TRANSCRIPTION_MODELS) {
      const descriptor = getOpenAiTranscriptionModelDescriptor(model);
      expect(descriptor.model).toBe(model);
      // PROD-363 AC: models hidden until runtime support is complete.
      expect(descriptor.enabled).toBe(false);
      // PROD-363 AC: document diarization limitation.
      expect(descriptor.capabilities.diarization).toBe(false);
    }
  });

  it("descriptor count matches the registry", () => {
    expect(OPENAI_TRANSCRIPTION_MODEL_DESCRIPTORS.length).toBe(
      OPENAI_TRANSCRIPTION_MODELS.length,
    );
  });

  it("isOpenAiTranscriptionModel narrows known + unknown strings", () => {
    expect(isOpenAiTranscriptionModel("whisper-1")).toBe(true);
    expect(isOpenAiTranscriptionModel("gpt-4o-mini-transcribe")).toBe(true);
    expect(isOpenAiTranscriptionModel("nova-3")).toBe(false);
  });

  it("only whisper-1 advertises verbose_json segment support", () => {
    const whisper = getOpenAiTranscriptionModelDescriptor("whisper-1");
    const gpt = getOpenAiTranscriptionModelDescriptor("gpt-4o-transcribe");
    expect(whisper.capabilities.verboseJson).toBe(true);
    expect(gpt.capabilities.verboseJson).toBe(false);
  });
});

describe("transcribeAudio", () => {
  const client: OpenAiClient = {
    apiKey: "sk-test-abc",
    baseUrl: "https://api.openai.com/v1",
  };
  const audio = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // "RIFF" header bytes

  it("posts multipart audio to /audio/transcriptions with the right model + auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeOkResponse({ text: "hello world" }),
    );

    await transcribeAudio(client, {
      audio,
      model: "gpt-4o-mini-transcribe",
      filename: "clip.webm",
      contentType: "audio/webm",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-abc");
    expect(init.body).toBeInstanceOf(FormData);

    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(form.get("response_format")).toBe("json");
    const file = form.get("file");
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name ?? "clip.webm").toBe("clip.webm");
  });

  it("returns a normalized result for gpt-4o-transcribe (json shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeOkResponse({
        text: "transcript body",
        language: "en",
      }),
    );

    const result = await transcribeAudio(client, {
      audio,
      model: "gpt-4o-transcribe",
      fetchImpl,
    });

    expect(result.text).toBe("transcript body");
    expect(result.model).toBe("gpt-4o-transcribe");
    expect(result.language).toBe("en");
    expect(result.segments).toBeUndefined();
    expect(result.durationSeconds).toBeUndefined();
  });

  it("parses whisper-1 verbose_json segments + duration", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeOkResponse({
        text: "hello world",
        language: "en",
        duration: 4.2,
        segments: [
          { id: 0, start: 0, end: 1.2, text: "hello" },
          { id: 1, start: 1.2, end: 2.4, text: "world" },
        ],
      }),
    );

    const result = await transcribeAudio(client, {
      audio,
      model: "whisper-1",
      fetchImpl,
    });

    expect(result.text).toBe("hello world");
    expect(result.language).toBe("en");
    expect(result.durationSeconds).toBe(4.2);
    expect(result.segments).toHaveLength(2);
    expect(result.segments?.[0].text).toBe("hello");
  });

  it("defaults whisper-1 to verbose_json", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeOkResponse({ text: "h" }));

    await transcribeAudio(client, { audio, model: "whisper-1", fetchImpl });

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(form.get("response_format")).toBe("verbose_json");
  });

  it("defaults gpt-4o-mini-transcribe to json (verbose_json unsupported)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeOkResponse({ text: "h" }));

    await transcribeAudio(client, {
      audio,
      model: "gpt-4o-mini-transcribe",
      fetchImpl,
    });

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(form.get("response_format")).toBe("json");
  });

  it("rejects verbose_json when model is not whisper-1", async () => {
    const fetchImpl = vi.fn();
    await expect(
      transcribeAudio(client, {
        audio,
        model: "gpt-4o-transcribe",
        responseFormat: "verbose_json",
        fetchImpl,
      }),
    ).rejects.toThrow(/verbose_json/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unsupported models", async () => {
    const fetchImpl = vi.fn();
    await expect(
      transcribeAudio(client, {
        audio,
        // @ts-expect-error -- intentionally bad model
        model: "nova-3",
        fetchImpl,
      }),
    ).rejects.toThrow(/Unsupported OpenAI transcription model/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forwards language, prompt, and temperature to the form", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeOkResponse({ text: "x" }));

    await transcribeAudio(client, {
      audio,
      model: "gpt-4o-transcribe",
      language: "es",
      prompt: "Tech meeting jargon",
      temperature: 0.2,
      fetchImpl,
    });

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(form.get("language")).toBe("es");
    expect(form.get("prompt")).toBe("Tech meeting jargon");
    expect(form.get("temperature")).toBe("0.2");
  });

  it("returns text-only response when responseFormat=text", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeOkResponse("plain transcript", { isText: true }));

    const result = await transcribeAudio(client, {
      audio,
      model: "gpt-4o-mini-transcribe",
      responseFormat: "text",
      fetchImpl,
    });

    expect(result.text).toBe("plain transcript");
    expect(result.raw).toBe("plain transcript");
  });

  it("throws OpenAiTranscriptionError on non-2xx responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeErrorResponse(429, "rate limited"));

    await expect(
      transcribeAudio(client, {
        audio,
        model: "whisper-1",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: "OpenAiTranscriptionError",
      status: 429,
      body: "rate limited",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not hit the live API -- only the injected fetch is called", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeOkResponse({ text: "ok" }));
    const globalSpy = vi.spyOn(globalThis, "fetch");

    await transcribeAudio(client, {
      audio,
      model: "whisper-1",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(globalSpy).not.toHaveBeenCalled();
    globalSpy.mockRestore();
  });

  it("OpenAiTranscriptionError exposes status + body for callers", () => {
    const err = new OpenAiTranscriptionError("boom", 500, "server fail");
    expect(err.status).toBe(500);
    expect(err.body).toBe("server fail");
    expect(err.name).toBe("OpenAiTranscriptionError");
  });
});
