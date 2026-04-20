/**
 * Next.js instrumentation -- loads at server startup.
 *
 * Wires OpenTelemetry for Langfuse when env vars are present. Critical
 * design rule: **this function must not throw**. Any failure here takes
 * down every route in the app and produces "Internal Server Error" with
 * no logs -- the exact silent-500 failure mode the kit exists to prevent.
 *
 * If Langfuse env vars are missing, we log once and continue. The stdout
 * logger (lib/logger.ts) still works.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const hasLangfuse = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  if (!hasLangfuse) {
    // Intentionally not throwing. Logs flow through the stdout logger.
    console.warn(
      '[instrumentation] LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set -- OpenTelemetry export disabled. ' +
        'AI SDK calls will still run; they just won\'t be forwarded to Langfuse.',
    );
    return;
  }

  try {
    await import('./lib/langfuse-setup');
  } catch (err) {
    // Last line of defense. If Langfuse SDK init blows up (bad keys,
    // network, peer dep missing), we warn but keep the server alive.
    console.error('[instrumentation] Langfuse setup failed -- continuing without OTel export.', err);
  }
}
