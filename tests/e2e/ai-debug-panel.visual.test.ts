import { mkdirSync } from "fs";
import { test, expect } from "@playwright/test";

test("ai-debug-panel visual proof records a browser event", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/control-plane", { waitUntil: "domcontentloaded" });
  const panel = page.getByTestId("ai-debug-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });

  const pushVisualProofEvent = () => page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("ai-debug", {
        detail: {
          id: "debug-visual-1",
          label: "visual-proof",
          provider: "vercel-ai-gateway",
          modelId: "anthropic/claude-haiku-4-5",
          duration: 860,
          steps: 2,
          inputTokens: 1440,
          outputTokens: 380,
          cost: 0.0029,
          toolCalls: ["searchDocuments"],
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          timestamp: Date.now(),
        },
      }),
    );
  });

  await expect
    .poll(async () => {
      await pushVisualProofEvent();
      return page.getByText("visual-proof").count();
    }, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect(page.getByText("visual-proof").first()).toBeVisible({ timeout: 15_000 });

  mkdirSync(".evidence/screenshots", { recursive: true });
  await panel.screenshot({
    path: ".evidence/screenshots/ai-debug-panel.png",
    timeout: 15_000,
  });
});
