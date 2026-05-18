import type { Page } from "@playwright/test";

const COMPLETED_ONBOARDING_STATE = {
  version: 1,
  welcomeSeen: true,
  tourStepsCompleted: ["record", "calendar", "mcp"],
  firstMeetingSeen: true,
  skippedAll: true,
  completedAt: "2026-05-17T00:00:00.000Z",
};

export async function completeOnboardingBeforeNavigation(
  page: Page,
): Promise<void> {
  await page.addInitScript((state) => {
    window.localStorage.setItem("layers_onboarding_v1", JSON.stringify(state));
  }, COMPLETED_ONBOARDING_STATE);
}
