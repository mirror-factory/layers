/**
 * GET /api/models
 *
 * Fetches available LLM models from the Vercel AI Gateway with live pricing.
 * Caches for 5 minutes to avoid hammering the Gateway on every settings page load.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GatewayModel {
  id: string;
  name: string;
  owned_by: string;
  context_window?: number;
  pricing?: {
    input?: string;
    output?: string;
  };
}

interface ModelOption {
  value: string;
  label: string;
  price: string;
  provider: string;
}

let cache: { data: ModelOption[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Providers and model families we want to show as summarization options. */
const WANTED_PROVIDERS = ["anthropic", "openai", "google"];

/** Pick the best 3 from each provider — prefer the latest, cheapest viable models. */
function pickTopModels(all: GatewayModel[]): ModelOption[] {
  const byProvider: Record<string, GatewayModel[]> = {};

  for (const m of all) {
    const provider = m.id.split("/")[0];
    if (!WANTED_PROVIDERS.includes(provider)) continue;
    if (m.id.includes("image") || m.id.includes("codex") || m.id.includes("instruct")) continue;
    if (!m.pricing?.input || !m.pricing?.output) continue;
    byProvider[provider] ??= [];
    byProvider[provider].push(m);
  }

  const result: ModelOption[] = [];

  for (const provider of WANTED_PROVIDERS) {
    const models = byProvider[provider] ?? [];
    // Sort by input cost ascending (cheapest first)
    models.sort(
      (a, b) =>
        parseFloat(a.pricing!.input!) - parseFloat(b.pricing!.input!),
    );
    // Take up to 3 per provider
    for (const m of models.slice(0, 3)) {
      const inCost = (parseFloat(m.pricing!.input!) * 1e6).toFixed(2);
      const outCost = (parseFloat(m.pricing!.output!) * 1e6).toFixed(2);
      result.push({
        value: m.id,
        label: m.name,
        price: `$${inCost} / $${outCost} per 1M tokens`,
        provider: m.owned_by,
      });
    }
  }

  return result;
}

export async function GET(): Promise<NextResponse> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    const { data } = (await res.json()) as { data: GatewayModel[] };
    const models = pickTopModels(data);
    cache = { data: models, ts: Date.now() };
    return NextResponse.json(models);
  } catch (err) {
    console.error("Failed to fetch Gateway models", err);
    // Return a static fallback
    return NextResponse.json([
      { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", price: "$0.10 / $0.40 per 1M tokens", provider: "google" },
      { value: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", price: "$0.07 / $0.30 per 1M tokens", provider: "google" },
      { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", price: "$0.15 / $0.60 per 1M tokens", provider: "google" },
      { value: "openai/gpt-5-nano", label: "GPT-5 nano", price: "$0.05 / $0.40 per 1M tokens", provider: "openai" },
      { value: "openai/gpt-4.1-nano", label: "GPT-4.1 nano", price: "$0.10 / $0.40 per 1M tokens", provider: "openai" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", price: "$0.40 / $1.60 per 1M tokens", provider: "openai" },
      { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", price: "$1.00 / $5.00 per 1M tokens", provider: "anthropic" },
      { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", price: "$3.00 / $15.00 per 1M tokens", provider: "anthropic" },
      { value: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7", price: "$5.00 / $25.00 per 1M tokens", provider: "anthropic" },
    ]);
  }
}
