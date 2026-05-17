import { test, expect } from "@playwright/test";

test("app/dev-kit/config/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/dev-kit/config", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Config" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Design tokens/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("textarea")).toBeVisible();
});
