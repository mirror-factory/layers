import { describe, expect, it } from "vitest";
import {
  getSpendBurnRows,
  summarizeAiGatewayDailyBurn,
} from "@/lib/ops/spend-caps";

describe("getSpendBurnRows", () => {
  it("sorts vendors by monthly run-rate percentage of cap", () => {
    const rows = getSpendBurnRows({
      "vercel-ai-gateway": 12,
      "ai-gateway-anthropic": 8,
      assemblyai: 0.5,
    });

    expect(rows[0]).toMatchObject({
      id: "ai-gateway-anthropic",
      dailyBurnUsd: 8,
      monthlyRunRateUsd: 240,
      percentOfCap: 200,
      status: "at-cap",
      burnSource: "observed",
    });
    expect(rows[1]).toMatchObject({
      id: "vercel-ai-gateway",
      percentOfCap: 180,
      status: "at-cap",
    });
  });

  it("handles free-tier hard caps and revenue-side vendors", () => {
    const rows = getSpendBurnRows({ inngest: 0.01 });
    const inngest = rows.find((row) => row.id === "inngest");
    const stripe = rows.find((row) => row.id === "stripe");

    expect(inngest).toMatchObject({
      capUsdMonthly: 0,
      percentOfCap: 100,
      status: "at-cap",
    });
    expect(stripe).toMatchObject({
      capUsdMonthly: null,
      percentOfCap: null,
      status: "not-applicable",
    });
  });
});

describe("summarizeAiGatewayDailyBurn", () => {
  it("groups today's AI Gateway spend into provider sub-budgets", () => {
    const burn = summarizeAiGatewayDailyBurn(
      [
        {
          timestamp: "2026-05-08T01:00:00.000Z",
          cost: 1.5,
          provider: "anthropic",
          modelId: "claude-sonnet-4-6",
        },
        {
          timestamp: "2026-05-08T02:00:00.000Z",
          cost: 0.25,
          provider: "gateway",
          modelId: "openai/gpt-4.1-mini",
        },
        {
          timestamp: "2026-05-08T03:00:00.000Z",
          cost: 0.1,
          provider: "gateway",
          modelId: "google/gemini-2.5-flash",
        },
        {
          timestamp: "2026-05-07T23:59:00.000Z",
          cost: 99,
          provider: "anthropic",
          modelId: "claude-sonnet-4-6",
        },
      ],
      new Date("2026-05-08T12:00:00.000Z"),
    );

    expect(burn["vercel-ai-gateway"]).toBeCloseTo(1.85);
    expect(burn["ai-gateway-anthropic"]).toBeCloseTo(1.5);
    expect(burn["ai-gateway-openai"]).toBeCloseTo(0.25);
    expect(burn["ai-gateway-google"]).toBeCloseTo(0.1);
  });
});
