/**
 * /record/live smoke test.
 *
 * Verifies the page renders and the start button is reachable. Doesn't
 * request a real mic or hit AssemblyAI — CI has no audio stack and no
 * API credits. Live WebSocket coverage lives in the eval suite.
 */

import { test, expect } from "@playwright/test";

test.describe("/record/live", () => {
  test("loads with start control and links to batch mode + meetings", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const res = await page.goto("/record/live", { waitUntil: "networkidle" });
    expect(res?.status()).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: "Live recording" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /start live session/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /batch mode/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /all meetings/i }),
    ).toBeVisible();

    const nonIgnored = errors.filter(
      (e) => !/favicon|Download the React DevTools|\[Fast Refresh\]/.test(e),
    );
    expect(
      nonIgnored,
      `console errors on /record/live: ${nonIgnored.join(", ")}`,
    ).toEqual([]);
  });
});
