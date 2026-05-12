import { test, expect } from "@playwright/test";

test("app/chat/page.tsx route smoke proof", async ({ page }) => {
  const response = await page.goto("/chat", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
  await expect(page.getByText("Ask anything from your meeting library.")).toBeVisible();
  await expect(page.getByPlaceholder("Ask about your meetings...")).toBeVisible();
});
