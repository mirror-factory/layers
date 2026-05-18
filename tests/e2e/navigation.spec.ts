/**
 * Navigation tests -- verify links, buttons, and the slide menu work.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { completeOnboardingBeforeNavigation } from "./helpers/onboarding";

const NAVIGATION_TEST_TIMEOUT = 20_000;

async function openPublicMobileMenu(page: Page) {
  const menuButton = page.locator('button[aria-controls="mobile-nav-panel"]');
  const mobilePanel = page.locator("#mobile-nav-panel");

  await expect(menuButton).toBeVisible();
  await expect(menuButton).toBeEnabled();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await mobilePanel.isVisible()) return;

    await menuButton.click();

    try {
      await expect(menuButton).toHaveAttribute("aria-expanded", "true", {
        timeout: 2_000,
      });
      await expect(mobilePanel).toBeVisible({ timeout: 2_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }
}

async function expectSignInReachable(page: Page) {
  const signIn = page
    .locator('a[href="/sign-in"]')
    .filter({ hasText: "Sign in" });

  if (await signIn.first().isVisible()) {
    await expect(signIn.first()).toBeVisible();
    return;
  }

  await openPublicMobileMenu(page);
  await expect(signIn.filter({ visible: true }).first()).toBeVisible();
}

async function openAccountNavigation(page: Page) {
  const menuButton = page.locator('button[aria-label="Open account menu"]');
  const nav = page.locator('nav[aria-label="Account navigation"]');

  await expect(menuButton).toBeVisible();
  await expect(menuButton).toBeEnabled();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await menuButton.click();

    try {
      await expect(nav).toHaveClass(/translate-x-0/, { timeout: 2_000 });
      return nav;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }

  return nav;
}

test.describe("Home page navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
  });

  test("nav shows invite-only state with sign-in link and disabled hero CTA", async ({
    page,
  }) => {
    test.setTimeout(NAVIGATION_TEST_TIMEOUT);

    await expectSignInReachable(page);

    const comingSoon = page.getByRole("button", { name: "Coming soon" });
    await expect(comingSoon.first()).toBeVisible();
    await expect(comingSoon.first()).toBeDisabled();
  });

  test("landing renders hero, pricing, and final CTA sections", async ({
    page,
  }) => {
    test.setTimeout(NAVIGATION_TEST_TIMEOUT);

    await expect(
      page.getByRole("heading", { name: /AI memory for your meetings/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Simple pricing/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: /Ready to make every meeting/i,
      }),
    ).toBeVisible();
  });
});

test.describe("TopBar back button", () => {
  test("navigates back after app-shell link navigation", async ({ page }) => {
    test.setTimeout(NAVIGATION_TEST_TIMEOUT);

    await completeOnboardingBeforeNavigation(page);
    await page.goto("/record", { waitUntil: "load" });
    const nav = await openAccountNavigation(page);
    await nav.locator('a[href="/settings"]').click();
    await page.waitForURL("**/settings");

    const backButton = page.locator('button[aria-label="Go back"]');
    await expect(backButton).toBeVisible();

    await backButton.click();
    await page.waitForURL("**/record");
  });
});

test.describe("Slide menu", () => {
  test("settings menu opens and shows user-facing nav links only", async ({
    page,
  }) => {
    test.setTimeout(NAVIGATION_TEST_TIMEOUT);

    await completeOnboardingBeforeNavigation(page);
    await page.goto("/record", { waitUntil: "load" });

    const nav = await openAccountNavigation(page);

    // Check that account items are present and workspace links stay on the app surface.
    const expectedItems = ["Profile", "Usage", "Plan", "Settings"];

    for (const label of expectedItems) {
      await expect(nav.locator("a", { hasText: label }).first()).toBeVisible();
    }

    const hiddenInternalItems = [
      "Pricing Admin",
      "Roadmap",
      "Documentation",
      "Observability",
      "Record",
      "Meetings",
      "Search",
      "Chat",
    ];

    for (const label of hiddenInternalItems) {
      await expect(nav.locator("a", { hasText: label })).toHaveCount(0);
    }
  });

  test("close button dismisses menu", async ({ page }) => {
    test.setTimeout(NAVIGATION_TEST_TIMEOUT);

    await completeOnboardingBeforeNavigation(page);
    await page.goto("/record", { waitUntil: "load" });

    const nav = await openAccountNavigation(page);

    const closeButton = page.locator('button[aria-label="Close account menu"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Menu should slide away (translate-x-full makes it invisible)
    await expect(nav).toHaveClass(/translate-x-full/);
  });
});
