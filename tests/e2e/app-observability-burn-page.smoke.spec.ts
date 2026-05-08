import { test, expect } from "@playwright/test";

test("app/observability/burn/page.tsx route smoke proof", async ({ page }) => {
  await page.goto("/observability/burn");
  await expect(
    page.getByRole("heading", { name: "Vendor Burn Rate" }),
  ).toBeVisible();
});
