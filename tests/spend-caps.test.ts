import { describe, expect, it } from "vitest";
import {
  SPEND_CAP_ALERT_CHANNEL,
  SPEND_CAP_VENDORS,
  buildSpendCapBurnRows,
} from "@/lib/spend-caps";

describe("spend cap registry", () => {
  it("covers every PROD-396 vendor with an alert channel and kill-switch", () => {
    expect(SPEND_CAP_VENDORS.map((vendor) => vendor.id)).toEqual([
      "vercel",
      "ai-gateway",
      "supabase-storage",
      "supabase-egress",
      "anthropic-direct",
      "openai-direct",
      "google-ai",
      "assemblyai",
      "deepgram",
      "stripe",
      "inngest",
      "resend",
    ]);

    for (const vendor of SPEND_CAP_VENDORS) {
      expect(vendor.alertChannel).toBe(SPEND_CAP_ALERT_CHANNEL);
      expect(vendor.owner).toBeTruthy();
      expect(vendor.killSwitch).toMatch(/\S/);
      expect(vendor.burnSource).toMatch(/\S/);
      expect(vendor.alertThresholds).toEqual(expect.arrayContaining([50, 80, 100]));
    }
  });

  it("sorts dashboard rows by highest percentage of cap first", () => {
    const rows = buildSpendCapBurnRows({ aiGatewayDailyUsd: 9 });

    expect(rows[0]).toMatchObject({
      id: "ai-gateway",
      status: "watch",
    });
    expect(rows[0]?.percentOfDailyCap).toBe(90);

    const percentages = rows
      .map((row) => Math.max(row.percentOfMonthlyCap ?? -1, row.percentOfDailyCap ?? -1));
    expect(percentages).toEqual([...percentages].sort((a, b) => b - a));
  });

  it("keeps the Core tier meeting-cost estimate above 50% gross margin", () => {
    const coreMonthlyPriceUsd = 20;
    const perMeetingCogsUsd =
      0.060 + // AssemblyAI batch STT
      0.045 + // LLM summary + embeddings
      0.025 + // LLM ad-hoc chat
      0.0008 + // Supabase storage
      0.0009 + // Supabase egress
      0.000 + // Resend free tier
      0.000; // AI Gateway markup
    const monthlyCogsUsd = perMeetingCogsUsd * 20;
    const grossMargin = (coreMonthlyPriceUsd - monthlyCogsUsd) / coreMonthlyPriceUsd;

    expect(monthlyCogsUsd).toBeLessThan(10);
    expect(grossMargin).toBeGreaterThan(0.5);
  });
});
