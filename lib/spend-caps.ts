export type SpendCapVendorId =
  | "vercel"
  | "ai-gateway"
  | "supabase-storage"
  | "supabase-egress"
  | "anthropic-direct"
  | "openai-direct"
  | "google-ai"
  | "assemblyai"
  | "deepgram"
  | "stripe"
  | "inngest"
  | "resend";

export type SpendCapMode = "hard-cap" | "prepaid-hard-stop" | "alert-playbook" | "free-tier-hard-cap" | "revenue-side";

export interface SpendCapVendor {
  id: SpendCapVendorId;
  vendor: string;
  scope: string;
  monthlyCapUsd: number | null;
  dailyCapUsd: number | null;
  alertThresholds: readonly number[];
  alertChannel: string;
  owner: string;
  capMode: SpendCapMode;
  burnSource: string;
  killSwitch: string;
}

export interface SpendCapBurnInput {
  aiGatewayDailyUsd?: number;
}

export interface SpendCapBurnRow extends SpendCapVendor {
  dailyBurnUsd: number;
  projectedMonthlyUsd: number;
  percentOfMonthlyCap: number | null;
  percentOfDailyCap: number | null;
  status: "ok" | "watch" | "critical" | "uncapped";
}

export const SPEND_CAP_ALERT_CHANNEL = "support@mirrorfactory.ai";

export const SPEND_CAP_VENDORS: readonly SpendCapVendor[] = [
  {
    id: "vercel",
    vendor: "Vercel",
    scope: "hosting, edge functions, bandwidth",
    monthlyCapUsd: 20,
    dailyCapUsd: null,
    alertThresholds: [50, 75, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "Vercel team usage dashboard",
    killSwitch: "Pause production deployments or pause each project.",
  },
  {
    id: "ai-gateway",
    vendor: "Vercel AI Gateway",
    scope: "Anthropic, OpenAI, and Google model tokens",
    monthlyCapUsd: 200,
    dailyCapUsd: 10,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "prepaid-hard-stop",
    burnSource: "/api/ai-logs/stats local telemetry plus Vercel balance",
    killSwitch: "Disable auto top-up, revoke AI_GATEWAY_API_KEY, or let credits hit zero.",
  },
  {
    id: "supabase-storage",
    vendor: "Supabase storage",
    scope: "database disk and object storage size",
    monthlyCapUsd: 10,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "Supabase Org Billing usage",
    killSwitch: "Spend Cap blocks capped storage growth; pause project if spend continues.",
  },
  {
    id: "supabase-egress",
    vendor: "Supabase egress",
    scope: "storage downloads, database egress, realtime egress",
    monthlyCapUsd: 15,
    dailyCapUsd: 2,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "Supabase Org Billing usage",
    killSwitch: "Disable public file delivery, shorten signed URLs, then pause project if needed.",
  },
  {
    id: "anthropic-direct",
    vendor: "Anthropic direct",
    scope: "fallback Claude API calls outside gateway",
    monthlyCapUsd: 50,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "Anthropic Console usage limits",
    killSwitch: "Revoke ANTHROPIC_API_KEY and redeploy gateway-only model routing.",
  },
  {
    id: "openai-direct",
    vendor: "OpenAI direct",
    scope: "direct OpenAI calls outside gateway",
    monthlyCapUsd: 50,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "OpenAI billing usage limits",
    killSwitch: "Revoke OPENAI_API_KEY and redeploy without direct OpenAI fallback.",
  },
  {
    id: "google-ai",
    vendor: "Google AI / Vertex",
    scope: "Google model and Vertex usage",
    monthlyCapUsd: 50,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "alert-playbook",
    burnSource: "Google Cloud Billing budget",
    killSwitch: "Disable billing on the Google Cloud project and rotate keys.",
  },
  {
    id: "assemblyai",
    vendor: "AssemblyAI",
    scope: "batch and streaming transcription",
    monthlyCapUsd: 50,
    dailyCapUsd: 3,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "AssemblyAI usage dashboard",
    killSwitch: "Rotate ASSEMBLYAI_API_KEY and switch runtime provider to Deepgram only if needed.",
  },
  {
    id: "deepgram",
    vendor: "Deepgram",
    scope: "fallback streaming transcription",
    monthlyCapUsd: 30,
    dailyCapUsd: 2,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "hard-cap",
    burnSource: "Deepgram project billing dashboard",
    killSwitch: "Rotate DEEPGRAM_API_KEY and clear the env var in Vercel.",
  },
  {
    id: "stripe",
    vendor: "Stripe",
    scope: "billing customer and Radar fraud controls",
    monthlyCapUsd: null,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "revenue-side",
    burnSource: "Stripe Dashboard and Radar alerts",
    killSwitch: "Pause new subscriptions or rotate STRIPE_SECRET_KEY for emergency stop.",
  },
  {
    id: "inngest",
    vendor: "Inngest",
    scope: "background job runs",
    monthlyCapUsd: 0,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "free-tier-hard-cap",
    burnSource: "Inngest plan usage",
    killSwitch: "Pause functions or rotate INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.",
  },
  {
    id: "resend",
    vendor: "Resend",
    scope: "onboarding and transactional emails",
    monthlyCapUsd: 0,
    dailyCapUsd: null,
    alertThresholds: [50, 80, 100],
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capMode: "free-tier-hard-cap",
    burnSource: "Resend usage and billing dashboard",
    killSwitch: "Rotate RESEND_API_KEY and clear the env var in Vercel.",
  },
] as const;

const MANUAL_DAILY_BURN_USD: Partial<Record<SpendCapVendorId, number>> = {
  vercel: 0,
  "supabase-storage": 0,
  "supabase-egress": 0,
  "anthropic-direct": 0,
  "openai-direct": 0,
  "google-ai": 0,
  assemblyai: 0,
  deepgram: 0,
  stripe: 0,
  inngest: 0,
  resend: 0,
};

export function buildSpendCapBurnRows(input: SpendCapBurnInput = {}): SpendCapBurnRow[] {
  return SPEND_CAP_VENDORS.map((vendor) => {
    const dailyBurnUsd = vendor.id === "ai-gateway"
      ? Math.max(0, input.aiGatewayDailyUsd ?? 0)
      : Math.max(0, MANUAL_DAILY_BURN_USD[vendor.id] ?? 0);
    const projectedMonthlyUsd = dailyBurnUsd * 30;
    const percentOfMonthlyCap = vendor.monthlyCapUsd && vendor.monthlyCapUsd > 0
      ? (projectedMonthlyUsd / vendor.monthlyCapUsd) * 100
      : null;
    const percentOfDailyCap = vendor.dailyCapUsd && vendor.dailyCapUsd > 0
      ? (dailyBurnUsd / vendor.dailyCapUsd) * 100
      : null;

    return {
      ...vendor,
      dailyBurnUsd,
      projectedMonthlyUsd,
      percentOfMonthlyCap,
      percentOfDailyCap,
      status: spendCapStatus(vendor, percentOfMonthlyCap, percentOfDailyCap),
    };
  }).sort((a, b) => sortPercent(b) - sortPercent(a));
}

function spendCapStatus(
  vendor: SpendCapVendor,
  percentOfMonthlyCap: number | null,
  percentOfDailyCap: number | null,
): SpendCapBurnRow["status"] {
  if (vendor.capMode === "revenue-side") return "uncapped";
  const risk = Math.max(percentOfMonthlyCap ?? 0, percentOfDailyCap ?? 0);
  if (risk >= 100) return "critical";
  if (risk >= 80) return "watch";
  return "ok";
}

function sortPercent(row: SpendCapBurnRow): number {
  if (row.percentOfMonthlyCap == null && row.percentOfDailyCap == null) return -1;
  return Math.max(row.percentOfMonthlyCap ?? 0, row.percentOfDailyCap ?? 0);
}
