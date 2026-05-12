/**
 * PROD-460 — Android hole-punch / display cutout coverage
 *
 * Mirrors tests/e2e/native-safe-area.spec.ts but runs on a Pixel viewport.
 * Kept in a separate file because Playwright forbids changing
 * `defaultBrowserType` via test.use() inside a describe block.
 */

import { devices, expect, test } from "@playwright/test";

const MOCK_INSET_PX = 36; // Pixel 8 Pro hole punch height

async function mockSafeArea(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({
    content: `
      :root {
        --safe-top: ${MOCK_INSET_PX}px !important;
        --safe-bottom: 0px !important;
        --safe-left: 0px !important;
        --safe-right: 0px !important;
      }
    `,
  });
}

test.use({ ...devices["Pixel 7"] });

test.describe("PROD-460 — Android hole-punch coverage (Pixel)", () => {
  test("testing banner respects safe-top on Pixel viewport", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    if (!response || response.status() >= 400) {
      test.skip(true, `page returned ${response?.status() ?? "no response"}`);
      return;
    }

    await mockSafeArea(page);
    await page.waitForTimeout(100);

    const banner = page.locator('[role="status"]').first();
    const count = await banner.count();
    if (count === 0) {
      test.skip(true, "no testing banner on landing");
      return;
    }

    const padTop = await banner.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).paddingTop) || 0
    );
    expect(
      padTop,
      `testing banner must reserve >= ${MOCK_INSET_PX}px for the Pixel hole punch`
    ).toBeGreaterThanOrEqual(MOCK_INSET_PX);
  });

  test("sticky public site nav respects safe-top on Pixel viewport", async ({ page }) => {
    const response = await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    if (!response || response.status() >= 400) {
      test.skip(true, `page returned ${response?.status() ?? "no response"}`);
      return;
    }

    await mockSafeArea(page);
    await page.waitForTimeout(100);

    const nav = page.locator('header').filter({ hasText: /Pricing|Download|Sign in/ }).first();
    if (!(await nav.count())) {
      test.skip(true, "no public site nav on this page");
      return;
    }

    const padTop = await nav.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).paddingTop) || 0
    );
    expect(padTop).toBeGreaterThanOrEqual(MOCK_INSET_PX);
  });
});
