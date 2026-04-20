/**
 * Langfuse observability setup.
 *
 * Wires Langfuse into AI SDK v6 via OpenTelemetry. Every generateText /
 * streamText call is automatically traced.
 *
 * Setup:
 *   1. pnpm add @langfuse/otel @opentelemetry/sdk-node
 *   2. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env
 *   3. This file is imported from instrumentation.ts when env is set.
 *
 * Guard rules:
 *   - Never throw. instrumentation.ts already try/catches us, but we
 *     double up here so a broken peer dep (missing @opentelemetry/sdk-node)
 *     doesn't kill the server.
 *   - If required env is absent, warn and return without initialising.
 */

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;

if (!publicKey || !secretKey) {
  console.warn('[langfuse-setup] Missing env vars -- skipping OTel init.');
} else {
  try {
    const [{ NodeSDK }, { LangfuseSpanProcessor }] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@langfuse/otel'),
    ]);

    const sdk = new NodeSDK({
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey,
          secretKey,
          baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
        }),
      ],
    });

    sdk.start();
  } catch (err) {
    console.error('[langfuse-setup] init failed -- continuing without OTel export.', err);
  }
}

export {}; // treat as module
