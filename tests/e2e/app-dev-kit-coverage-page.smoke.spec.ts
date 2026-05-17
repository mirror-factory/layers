import { test, expect } from "@playwright/test";

test("app/dev-kit/coverage/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/dev-kit/coverage", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Tool coverage across unit tests")).toBeVisible();
  await expect(page.getByRole("main").getByText("Tools")).toBeVisible({
    timeout: 10_000,
  });
});
