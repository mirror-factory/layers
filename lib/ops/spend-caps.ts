export type SpendCapKind = "hard-cap" | "alert-playbook" | "revenue-side";

export interface SpendCapVendor {
  id: string;
  vendor: string;
  usedFor: string;
  monthlyCapUsd: number | null;
  alertChannel: string;
  owner: string;
  capKind: SpendCapKind;
  burnSource: string;
  killSwitch: string;
  defaultDailyBurnUsd: number;
}

export interface VendorBurnRow extends SpendCapVendor {
  dailyBurnUsd: number;
  projectedMonthlyBurnUsd: number;
  percentOfCap: number | null;
  alertState: "ok" | "watch" | "urgent" | "capped" | "uncapped";
}

export const SPEND_CAP_ALERT_CHANNEL = "support@mirrorfactory.ai";

export const CORE_TIER_PRICE_USD = 20;

export const COST_OF_ONE_MEETING_USD = {
  stt: 0.06,
  llmSummaryAndEmbeddings: 0.045,
  llmAdHocChat: 0.025,
  supabaseStorage: 0.0008,
  supabaseEgress: 0.0009,
  resendEmail: 0,
  aiGatewayMarkup: 0,
} as const;

export const COST_OF_ONE_MEETING_TOTAL_USD = Object.values(COST_OF_ONE_MEETING_USD).reduce(
  (total, value) => total + value,
  0,
);

export const CORE_TIER_MONTHLY_COGS_USD = COST_OF_ONE_MEETING_TOTAL_USD * 20;
export const CORE_TIER_GROSS_MARGIN_RATIO =
  (CORE_TIER_PRICE_USD - CORE_TIER_MONTHLY_COGS_USD) / CORE_TIER_PRICE_USD;

export const SPEND_CAP_VENDORS: SpendCapVendor[] = [
  {
    id: "vercel",
    vendor: "Vercel",
    usedFor: "Hosting, edge functions, bandwidth",
    monthlyCapUsd: 20,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Vercel team usage",
    killSwitch: "Pause production deployments or pause the project.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "supabase",
    vendor: "Supabase",
    usedFor: "Postgres, auth, storage, egress",
    monthlyCapUsd: 25,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Supabase org billing usage",
    killSwitch: "Spend Cap blocks capped resources; pause project for an immediate stop.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "ai-gateway",
    vendor: "Vercel AI Gateway",
    usedFor: "Anthropic, OpenAI, and Google AI token routing",
    monthlyCapUsd: 200,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "AI log cost today plus Gateway balance",
    killSwitch: "Disable auto top-up, revoke AI Gateway key, or let prepaid credits hit zero.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "anthropic",
    vendor: "Anthropic direct",
    usedFor: "Fallback Claude API",
    monthlyCapUsd: 50,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Anthropic usage limits",
    killSwitch: "Revoke ANTHROPIC_API_KEY and redeploy gateway-only configuration.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "openai",
    vendor: "OpenAI direct",
    usedFor: "Direct OpenAI API if enabled outside Gateway",
    monthlyCapUsd: 50,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "OpenAI usage limits",
    killSwitch: "Revoke OPENAI_API_KEY and redeploy.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "google-ai",
    vendor: "Google AI / Vertex",
    usedFor: "Google AI models and Google Cloud APIs",
    monthlyCapUsd: 50,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "alert-playbook",
    burnSource: "Cloud Billing budget",
    killSwitch: "Disable billing on the Google Cloud project.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "assemblyai",
    vendor: "AssemblyAI",
    usedFor: "Batch and streaming transcription",
    monthlyCapUsd: 50,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "AssemblyAI usage dashboard",
    killSwitch: "Rotate ASSEMBLYAI_API_KEY and redeploy.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "deepgram",
    vendor: "Deepgram",
    usedFor: "Fallback streaming transcription",
    monthlyCapUsd: 30,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Deepgram project usage",
    killSwitch: "Rotate DEEPGRAM_API_KEY and redeploy with AssemblyAI as primary.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "stripe",
    vendor: "Stripe",
    usedFor: "Revenue-side billing customer",
    monthlyCapUsd: null,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "revenue-side",
    burnSource: "Radar and dashboard alerts",
    killSwitch: "Pause new subscriptions or rotate STRIPE_SECRET_KEY during fraud incident.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "inngest",
    vendor: "Inngest",
    usedFor: "Background jobs",
    monthlyCapUsd: 0,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Free-tier usage dashboard",
    killSwitch: "Pause functions or rotate Inngest event/signing keys.",
    defaultDailyBurnUsd: 0,
  },
  {
    id: "resend",
    vendor: "Resend",
    usedFor: "Onboarding and transactional email",
    monthlyCapUsd: 0,
    alertChannel: SPEND_CAP_ALERT_CHANNEL,
    owner: "founder",
    capKind: "hard-cap",
    burnSource: "Free-tier usage dashboard",
    killSwitch: "Rotate RESEND_API_KEY and redeploy.",
    defaultDailyBurnUsd: 0,
  },
];

export function getVendorBurnRows(overrides: Record<string, number> = {}): VendorBurnRow[] {
  return SPEND_CAP_VENDORS.map((vendor) => {
    const dailyBurnUsd = overrides[vendor.id] ?? vendor.defaultDailyBurnUsd;
    const projectedMonthlyBurnUsd = dailyBurnUsd * 30;
    const percentOfCap =
      vendor.monthlyCapUsd && vendor.monthlyCapUsd > 0
        ? (projectedMonthlyBurnUsd / vendor.monthlyCapUsd) * 100
        : null;

    return {
      ...vendor,
      dailyBurnUsd,
      projectedMonthlyBurnUsd,
      percentOfCap,
      alertState: getAlertState(percentOfCap, vendor.monthlyCapUsd),
    };
  }).sort((a, b) => (b.percentOfCap ?? -1) - (a.percentOfCap ?? -1));
}

function getAlertState(
  percentOfCap: number | null,
  monthlyCapUsd: number | null,
): VendorBurnRow["alertState"] {
  if (monthlyCapUsd === null) return "uncapped";
  if (monthlyCapUsd === 0) return "capped";
  if (percentOfCap === null) return "uncapped";
  if (percentOfCap >= 100) return "urgent";
  if (percentOfCap >= 80) return "urgent";
  if (percentOfCap >= 50) return "watch";
  return "ok";
}
