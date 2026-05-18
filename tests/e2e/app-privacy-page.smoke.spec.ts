import { test, expect } from "@playwright/test";

test("app/privacy/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/privacy", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Launch draft - legal review pending")).toBeVisible();
  await expect(
    page.getByLabel("Related actions").getByRole("link", {
      name: "Delete account",
    }),
  ).toBeVisible();
});
