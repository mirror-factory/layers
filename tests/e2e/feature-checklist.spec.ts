/**
 * Product feature checklist.
 *
 * These tests intentionally avoid microphone prompts, paid providers, payment
 * redirects, and auth submissions. They verify each core feature surface is
 * present and handles safe local interactions.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { completeOnboardingBeforeNavigation } from "./helpers/onboarding";

async function expectSignInReachable(page: Page) {
  const signIn = page
    .locator('a[href="/sign-in"]')
    .filter({ hasText: "Sign in" });

  if (await signIn.first().isVisible()) {
    await expect(signIn.first()).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(signIn.filter({ visible: true }).first()).toBeVisible();
}

test.describe("Feature checklist", () => {
  test("landing page exposes product positioning, demo, pricing, and auth CTAs", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", {
        name: /AI memory for your meetings/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Meeting memory").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Bring meeting memory into/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Find the decision/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Simple pricing\./i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coming soon" }).first(),
    ).toBeVisible();
    await expectSignInReachable(page);
  });

  test("recording surfaces render without requesting microphone access", async ({
    page,
  }) => {
    await completeOnboardingBeforeNavigation(page);
    await page.goto("/record", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "Recent recordings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    const width = page.viewportSize()?.width ?? 1280;
    if (width >= 1024) {
      await expect(
        page.getByRole("link", { name: /Layers MCP connection/ }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Calendar context" }),
      ).toBeVisible();
    }

    await page.goto("/record/live", { waitUntil: "load" });
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Product planning session" }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("meeting, search, and chat empty states are usable", async ({
    page,
  }) => {
    await page.goto("/meetings", { waitUntil: "load" });
    await expect(
      page.getByPlaceholder("Search across all meetings..."),
    ).toBeVisible();
    await expect(page.getByText("No meetings yet.")).toBeVisible();

    await page.goto("/search", { waitUntil: "load" });
    await page.getByPlaceholder("Search meetings...").fill("budget");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(
      page.getByText("No results found. Try a different search term."),
    ).toBeVisible();

    await page.goto("/chat", { waitUntil: "load" });
    await expect(
      page.getByText("Ask anything from your meeting library."),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Ask about your meetings..."),
    ).toBeVisible();
  });

  test("settings model controls persist safe local changes", async ({
    page,
  }) => {
    await page.goto("/settings", { waitUntil: "load" });

    const batchSpeech = page
      .locator(".glass-card")
      .filter({ hasText: "Batch Speech Model" })
      .locator("select");
    await expect(batchSpeech).toBeVisible();
    await batchSpeech.selectOption("universal-3-pro");
    await expect(batchSpeech).toHaveValue("universal-3-pro");
  });

  test("pricing and account pages render without starting checkout or auth submissions", async ({
    page,
  }) => {
    await page.goto("/pricing", { waitUntil: "load" });
    // Public pricing during the invite-only alpha: the h1 is now
    // "Pay for the meeting memory ..." and every tier CTA reads
    // "Coming soon" / disabled. Match generously so editorial copy can
    // evolve without breaking this gate.
    await expect(
      page.getByRole("heading", { name: /pay for the meeting memory/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coming soon" }).first(),
    ).toBeVisible();

    await page.goto("/sign-in", { waitUntil: "load" });
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.goto("/sign-up", { waitUntil: "load" });
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("dev and observability surfaces render", async ({ page }) => {
    await page.goto("/observability", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "AI Observability" }),
    ).toBeVisible();
    await expect(page.getByText("Auto-refresh")).toBeVisible();

    await page.goto("/dev-kit/status", { waitUntil: "load" });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("observability fits the mobile viewport without page-level horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/observability", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "AI Observability" }),
    ).toBeVisible();

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
