export type SpendCapId =
  | "vercel-hosting"
  | "supabase-db-auth"
  | "supabase-storage"
  | "supabase-egress"
  | "vercel-ai-gateway"
  | "ai-gateway-anthropic"
  | "ai-gateway-openai"
  | "ai-gateway-google"
  | "anthropic-direct"
  | "openai-direct"
  | "google-ai-vertex"
  | "assemblyai"
  | "deepgram"
  | "stripe"
  | "inngest"
  | "resend";

export type SpendCapStatus =
  | "ok"
  | "watch"
  | "danger"
  | "at-cap"
  | "not-applicable";

export interface SpendCapConfig {
  id: SpendCapId;
  vendor: string;
  usedFor: string;
  capUsdMonthly: number | null;
  alertChannel: string;
  owner: string;
  source: "live-ai-logs" | "vendor-dashboard" | "manual" | "not-applicable";
  projectedDailyBurnUsd: number;
  killSwitch: string;
}

export interface SpendBurnRow extends SpendCapConfig {
  dailyBurnUsd: number;
  monthlyRunRateUsd: number;
  percentOfCap: number | null;
  status: SpendCapStatus;
  burnSource: "observed" | "projected";
}

export type SpendBurnOverrides = Partial<Record<SpendCapId, number>>;

export interface AiGatewayCostLog {
  timestamp: string;
  cost: number;
  provider: string;
  modelId: string;
}

export const SPEND_CAPS: SpendCapConfig[] = [
  {
    id: "vercel-hosting",
    vendor: "Vercel",
    usedFor: "Hosting, edge functions, bandwidth",
    capUsdMonthly: 20,
    alertChannel: "Email/web alerts to support@mirrorfactory.ai at 50/75/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Spend Management pauses production deployments; manually pause projects for immediate cutoff.",
  },
  {
    id: "supabase-db-auth",
    vendor: "Supabase database/auth",
    usedFor: "Postgres, Auth, Realtime",
    capUsdMonthly: 25,
    alertChannel: "Org billing email plus Cost Control alert at 80%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Enable Spend Cap; pause project from Settings > General if compute or auth usage runs away.",
  },
  {
    id: "supabase-storage",
    vendor: "Supabase storage",
    usedFor: "Audio objects and transcripts at rest",
    capUsdMonthly: 10,
    alertChannel: "Storage usage alert at 50/80/100% of the storage sub-budget",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0.006,
    killSwitch: "Disable uploads, shorten signed URL TTLs, and pause project if storage growth continues.",
  },
  {
    id: "supabase-egress",
    vendor: "Supabase egress",
    usedFor: "Audio/transcript downloads and API egress",
    capUsdMonthly: 15,
    alertChannel: "Egress alert at 50/80/100% of the egress sub-budget",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0.006,
    killSwitch: "Block audio downloads, revoke public URLs, rotate anon key if abuse continues.",
  },
  {
    id: "vercel-ai-gateway",
    vendor: "Vercel AI Gateway",
    usedFor: "Primary LLM token path",
    capUsdMonthly: 200,
    alertChannel: "Prepaid balance review plus Langfuse/support alerts at 50/80/100%",
    owner: "founder",
    source: "live-ai-logs",
    projectedDailyBurnUsd: 0.47,
    killSwitch: "Disable auto top-up, revoke AI Gateway key, or set AI_GATEWAY_API_KEY to an invalid value.",
  },
  {
    id: "ai-gateway-anthropic",
    vendor: "AI Gateway - Anthropic budget",
    usedFor: "Claude models routed through Vercel AI Gateway",
    capUsdMonthly: 120,
    alertChannel: "Langfuse provider budget at 50/80/100%",
    owner: "founder",
    source: "live-ai-logs",
    projectedDailyBurnUsd: 0.35,
    killSwitch: "Route Claude models off in model router or revoke AI Gateway key.",
  },
  {
    id: "ai-gateway-openai",
    vendor: "AI Gateway - OpenAI budget",
    usedFor: "OpenAI models routed through Vercel AI Gateway",
    capUsdMonthly: 40,
    alertChannel: "Langfuse provider budget at 50/80/100%",
    owner: "founder",
    source: "live-ai-logs",
    projectedDailyBurnUsd: 0.06,
    killSwitch: "Route OpenAI models off in model router or revoke AI Gateway key.",
  },
  {
    id: "ai-gateway-google",
    vendor: "AI Gateway - Google budget",
    usedFor: "Gemini models routed through Vercel AI Gateway",
    capUsdMonthly: 40,
    alertChannel: "Langfuse provider budget at 50/80/100%",
    owner: "founder",
    source: "live-ai-logs",
    projectedDailyBurnUsd: 0.06,
    killSwitch: "Route Gemini models off in model router or revoke AI Gateway key.",
  },
  {
    id: "anthropic-direct",
    vendor: "Anthropic direct",
    usedFor: "Claude API fallback outside AI Gateway",
    capUsdMonthly: 50,
    alertChannel: "Console email alerts at 50/80/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Revoke ANTHROPIC_API_KEY and redeploy with gateway-only routing.",
  },
  {
    id: "openai-direct",
    vendor: "OpenAI direct",
    usedFor: "OpenAI API calls outside AI Gateway",
    capUsdMonthly: 50,
    alertChannel: "Usage-limit email alerts at 50/80/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Revoke OPENAI_API_KEY and redeploy.",
  },
  {
    id: "google-ai-vertex",
    vendor: "Google AI / Vertex",
    usedFor: "Google AI APIs outside AI Gateway",
    capUsdMonthly: 50,
    alertChannel: "Cloud Billing budget email and Pub/Sub thresholds at 50/80/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Disable billing on the project and rotate keys.",
  },
  {
    id: "assemblyai",
    vendor: "AssemblyAI",
    usedFor: "Batch and streaming transcription",
    capUsdMonthly: 50,
    alertChannel: "Dashboard spend alerts at 50/80/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0.4,
    killSwitch: "Rotate ASSEMBLYAI_API_KEY and switch STT provider.",
  },
  {
    id: "deepgram",
    vendor: "Deepgram",
    usedFor: "Fallback streaming transcription",
    capUsdMonthly: 30,
    alertChannel: "Console spend alerts at 50/80/100%",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Rotate DEEPGRAM_API_KEY and switch STT provider back to AssemblyAI.",
  },
  {
    id: "stripe",
    vendor: "Stripe",
    usedFor: "Revenue collection and fraud controls",
    capUsdMonthly: null,
    alertChannel: "Radar, disputes, and failed-webhook email alerts",
    owner: "founder",
    source: "not-applicable",
    projectedDailyBurnUsd: 0,
    killSwitch: "Pause new subscriptions; rotate STRIPE_SECRET_KEY only for an active key incident.",
  },
  {
    id: "inngest",
    vendor: "Inngest",
    usedFor: "Background jobs",
    capUsdMonthly: 0,
    alertChannel: "Free-tier exhaustion email; 80% alert before paid upgrade",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Pause functions or rotate INNGEST_EVENT_KEY/INNGEST_SIGNING_KEY when wired.",
  },
  {
    id: "resend",
    vendor: "Resend",
    usedFor: "Transactional onboarding email",
    capUsdMonthly: 0,
    alertChannel: "Free-tier exhaustion email; 80% alert before paid upgrade",
    owner: "founder",
    source: "vendor-dashboard",
    projectedDailyBurnUsd: 0,
    killSwitch: "Rotate RESEND_API_KEY and redeploy with email disabled.",
  },
];

export function getSpendBurnRows(
  overrides: SpendBurnOverrides = {},
  daysPerMonth = 30,
): SpendBurnRow[] {
  return SPEND_CAPS.map((cap) => {
    const hasObservedBurn = Object.prototype.hasOwnProperty.call(overrides, cap.id);
    const dailyBurnUsd = hasObservedBurn
      ? Math.max(0, overrides[cap.id] ?? 0)
      : cap.projectedDailyBurnUsd;
    const monthlyRunRateUsd = dailyBurnUsd * daysPerMonth;
    const percentOfCap = percentOfMonthlyCap(monthlyRunRateUsd, cap.capUsdMonthly);

    return {
      ...cap,
      dailyBurnUsd,
      monthlyRunRateUsd,
      percentOfCap,
      status: statusForPercent(percentOfCap),
      burnSource: hasObservedBurn ? "observed" : "projected",
    };
  }).sort((a, b) => {
    const aPercent = a.percentOfCap ?? -1;
    const bPercent = b.percentOfCap ?? -1;
    if (bPercent !== aPercent) return bPercent - aPercent;
    return b.monthlyRunRateUsd - a.monthlyRunRateUsd;
  });
}

export function summarizeAiGatewayDailyBurn(
  logs: AiGatewayCostLog[],
  now = new Date(),
): SpendBurnOverrides {
  const today = now.toISOString().slice(0, 10);
  const totals: SpendBurnOverrides = {
    "vercel-ai-gateway": 0,
    "ai-gateway-anthropic": 0,
    "ai-gateway-openai": 0,
    "ai-gateway-google": 0,
  };

  for (const log of logs) {
    if (!log.timestamp.startsWith(today) || !Number.isFinite(log.cost)) {
      continue;
    }

    const cost = Math.max(0, log.cost);
    totals["vercel-ai-gateway"] = (totals["vercel-ai-gateway"] ?? 0) + cost;

    const providerBudget = providerBudgetForLog(log);
    if (providerBudget) {
      totals[providerBudget] = (totals[providerBudget] ?? 0) + cost;
    }
  }

  return totals;
}

function percentOfMonthlyCap(
  monthlyRunRateUsd: number,
  capUsdMonthly: number | null,
): number | null {
  if (capUsdMonthly === null) return null;
  if (capUsdMonthly === 0) return monthlyRunRateUsd > 0 ? 100 : 0;
  return (monthlyRunRateUsd / capUsdMonthly) * 100;
}

function statusForPercent(percentOfCap: number | null): SpendCapStatus {
  if (percentOfCap === null) return "not-applicable";
  if (percentOfCap >= 100) return "at-cap";
  if (percentOfCap >= 80) return "danger";
  if (percentOfCap >= 50) return "watch";
  return "ok";
}

function providerBudgetForLog(log: AiGatewayCostLog): SpendCapId | null {
  const key = `${log.provider} ${log.modelId}`.toLowerCase();
  if (key.includes("anthropic") || key.includes("claude")) {
    return "ai-gateway-anthropic";
  }
  if (key.includes("openai") || key.includes("gpt-") || key.includes("o4")) {
    return "ai-gateway-openai";
  }
  if (key.includes("google") || key.includes("gemini")) {
    return "ai-gateway-google";
  }
  return null;
}
