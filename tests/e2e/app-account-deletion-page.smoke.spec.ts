import { test, expect } from "@playwright/test";

test("app/account-deletion/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/account-deletion", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", {
      name: "Delete your Layers account and data",
    }),
  ).toBeVisible();
  await expect(page.getByText("Draft, counsel pending")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Self-serve deletion is available from Profile",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Email deletion request" }),
  ).toBeVisible();
});
