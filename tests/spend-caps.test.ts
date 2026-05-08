import { describe, expect, test } from "vitest";
import {
  CORE_TIER_GROSS_MARGIN_RATIO,
  COST_OF_ONE_MEETING_TOTAL_USD,
  SPEND_CAP_ALERT_CHANNEL,
  SPEND_CAP_VENDORS,
  getVendorBurnRows,
} from "@/lib/ops/spend-caps";

const requiredVendorIds = [
  "vercel",
  "supabase",
  "ai-gateway",
  "anthropic",
  "openai",
  "google-ai",
  "assemblyai",
  "deepgram",
  "stripe",
  "inngest",
  "resend",
];

describe("spend cap registry", () => {
  test("covers every vendor required by PROD-396", () => {
    expect(SPEND_CAP_VENDORS.map((vendor) => vendor.id).sort()).toEqual(
      requiredVendorIds.sort(),
    );
  });

  test("routes every alert to the support mailbox", () => {
    expect(
      SPEND_CAP_VENDORS.every(
        (vendor) => vendor.alertChannel === SPEND_CAP_ALERT_CHANNEL,
      ),
    ).toBe(true);
  });

  test("sorts daily burn rows by projected percent of cap", () => {
    const rows = getVendorBurnRows({
      vercel: 1,
      "ai-gateway": 20,
      assemblyai: 3,
    });

    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
      "ai-gateway",
      "assemblyai",
      "vercel",
    ]);
    expect(rows[0].percentOfCap).toBeGreaterThanOrEqual(rows[1].percentOfCap ?? 0);
  });

  test("keeps the Core tier meeting estimate above 50 percent gross margin", () => {
    expect(COST_OF_ONE_MEETING_TOTAL_USD).toBeCloseTo(0.1317, 4);
    expect(CORE_TIER_GROSS_MARGIN_RATIO).toBeGreaterThan(0.5);
  });
});
