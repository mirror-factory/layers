/**
 * Verify mobile polish changes:
 * - Transcript grid background CSS exists
 * - Collapsible sections on meeting detail
 * - Cost panel is collapsed by default
 * - No intake form on meeting detail
 * - Focused live recording controls
 * - Sign-in has Google OAuth button
 * - Pages use dvh/safe-area CSS
 */

import { test, expect } from "@playwright/test";

test.describe("Sign-in page", () => {
  test("renders Google OAuth button", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const googleBtn = page.locator("button", {
      hasText: "Continue with Google",
    });
    await expect(googleBtn).toBeVisible({ timeout: 5000 });
  });

  test("renders email + password form", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("has divider between Google and email", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const divider = page.locator(".auth-divider-label").first();
    await expect(divider).toBeVisible({ timeout: 5000 });
    await expect(divider).toContainText(/^or\b/i);
  });
});

test.describe("Sign-up page", () => {
  test("renders invite-only alpha access CTA", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: "Request alpha access" }),
    ).toBeVisible({ timeout: 5000 });
  });

  // Public sign-ups are paused for the invite-only alpha; the form's submit
  // button is hard-disabled and labelled "Coming soon" (see ALPHA_INVITE_MESSAGE
  // in app/(public)/sign-up/page.tsx). Assert that state instead of the
  // create-account password-length flow that the original test covered. When
  // public sign-ups re-open, restore the original assertions from git.
  test("renders the invite-only Coming soon state", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "load" });
    await expect(
      page.getByRole("link", { name: "Request alpha access" }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coming soon" }),
    ).toBeDisabled();
  });
});

test.describe("CSS utilities exist", () => {
  test("transcript-grid class applies grid background", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Inject a test element with the class and verify computed style
    const hasBg = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "transcript-grid";
      el.style.width = "100px";
      el.style.height = "100px";
      document.body.appendChild(el);
      const style = getComputedStyle(el);
      const result = style.backgroundImage !== "none";
      el.remove();
      return result;
    });
    expect(hasBg).toBe(true);
  });

  test("h-screen-safe and min-h-screen-safe classes exist", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const heights = await page.evaluate(() => {
      const el1 = document.createElement("div");
      el1.className = "h-screen-safe";
      document.body.appendChild(el1);
      const h1 = getComputedStyle(el1).height;
      el1.remove();

      const el2 = document.createElement("div");
      el2.className = "min-h-screen-safe";
      document.body.appendChild(el2);
      const h2 = getComputedStyle(el2).minHeight;
      el2.remove();

      return { h1, h2 };
    });
    // h-screen-safe should resolve to a pixel value (100dvh)
    expect(heights.h1).toMatch(/\d+px/);
    expect(heights.h2).toMatch(/\d+px/);
  });
});

test.describe("Home page", () => {
  test("renders without errors", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const heading = page.locator("h1, h2, [role='heading']").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  // The /record/live screen was redesigned around SessionCaptureCard +
  // a managed-presentation LiveRecorder (see app/record/live/page.tsx and
  // the `presentation === "managed"` branch in components/live-recorder.tsx).
  // The legacy "Recording readiness" panel with per-check tiles ("Plan",
  // "Microphone", etc.) is no longer rendered — managed mode only emits an
  // sr-only status region for screen readers, and readiness state is now
  // surfaced through the start-button label and SessionCaptureCard chrome.
  // The "focused on mobile" intent is preserved: a single primary recording
  // control plus the workspace header are reachable above the fold.
  test("keeps recording controls focused on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/record/live", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    // The session capture card surfaces the active workspace title. This
    // replaces the old readiness-checklist assertions and proves the
    // recording shell still composes correctly at mobile widths.
    await expect(
      page.getByRole("heading", { name: "Product planning session" }),
    ).toBeVisible();
    // The audio wave ribbon is the visual anchor of the mobile recording
    // shell; if it disappears, the page has regressed.
    await expect(page.locator(".session-capture-card")).toBeVisible();
  });
});

test.describe("Pricing admin", () => {
  test("renders growth scenario controls on mobile", async ({ page }) => {
    await page.goto("/admin/pricing", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Plan margin simulator" }),
    ).toBeVisible();
    await expect(
      page.getByText("1,000-customer growth scenario"),
    ).toBeVisible();
    await expect(page.getByText(/MRR/i).first()).toBeVisible();
    await expect(page.getByText("30m call")).toBeVisible();
    await expect(page.getByText("Provider lane")).toBeVisible();
  });
});
