import { expect, test, type Locator, type Page } from "@playwright/test";

const ONBOARDING_KEY = "layers_onboarding_v1";

async function expectInViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function startFreshOnboarding(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, ONBOARDING_KEY);
}

async function completeOnboarding(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        welcomeSeen: true,
        tourStepsCompleted: ["record", "calendar", "mcp"],
        firstMeetingSeen: true,
        skippedAll: true,
        completedAt: "2026-05-18T00:00:00.000Z",
      }),
    );
  }, ONBOARDING_KEY);
}

test.describe("Onboarding safe-area layout", () => {
  test("welcome modal and tour popovers stay inside a notched mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startFreshOnboarding(page);
    await page.goto("/record", { waitUntil: "load" });

    const welcome = page.locator(".onboarding-welcome-card");
    await expectInViewport(page, welcome);

    await page.getByRole("button", { name: "Record now" }).click();

    const popover = page.locator(".onboarding-tour-popover");
    await expect(page.getByRole("dialog", { name: /Start a recording/i })).toBeVisible();
    await expectInViewport(page, popover);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: /Calendar context/i })).toBeVisible();
    await expectInViewport(page, popover);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("dialog", { name: /Bring Layers into your AI tool/i }),
    ).toBeVisible();
    await expectInViewport(page, popover);
  });

  test("microphone setup error stays contained on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await completeOnboarding(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new Error("This browser can't use the microphone");
          },
        },
      });
    });

    await page.goto("/record", { waitUntil: "load" });
    await page.getByRole("button", { name: "Start recording" }).click();

    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toHaveText(/Review setup/);
    const alert = page.locator(".recorder-error-alert");
    await expect(alert).toContainText("Microphone setup needs attention");
    await expectInViewport(page, alert);
    await expectInViewport(
      page,
      page.getByRole("button", { name: "Start recording" }),
    );
  });
});
