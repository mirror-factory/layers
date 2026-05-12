import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("chat-message visual proof", async ({ page }, testInfo) => {
  await page.goto("/dev-kit/design-system", { waitUntil: "domcontentloaded" });

  const proof = page.getByTestId("chat-message-proof");
  await expect(proof).toContainText("Reasoning");
  await expect(proof).toContainText("Verified tool contract coverage");

  mkdirSync(".evidence/screenshots", { recursive: true });
  await proof.screenshot({
    path: `.evidence/screenshots/chat-message-${testInfo.project.name}.png`,
    timeout: 15_000,
  });
});
