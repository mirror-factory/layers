import { test, expect } from "@playwright/test";

test("app/dev-kit/design-system/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/dev-kit/design-system", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
  await expect(page.getByTestId("chat-message-proof")).toContainText("Reasoning");
  await expect(page.getByTestId("chat-message-proof")).toContainText(
    "The chat renderer keeps reasoning",
  );
});
