/**
 * /record page smoke test.
 *
 * Does not hit AssemblyAI or the Gateway — those live behind env vars
 * and would cost money on every CI run. Instead this verifies:
 *   - the page loads without console errors
 *   - both input paths (record button + upload control) are reachable
 *   - the back-to-hub link exists
 *
 * Live transcription runs live in the eval suite (tests/evals/), not here.
 */

import { test, expect } from "@playwright/test";

test.describe("/record", () => {
  test("loads, exposes both inputs, links back to the hub", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const res = await page.goto("/record", { waitUntil: "networkidle" });
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Record" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /start recording/i }),
    ).toBeVisible();
    await expect(page.getByTestId("audio-file-input")).toBeAttached();
    await expect(page.getByRole("link", { name: /hub/i })).toBeVisible();

    const nonIgnored = errors.filter(
      (e) => !/favicon|Download the React DevTools|\[Fast Refresh\]/.test(e),
    );
    expect(nonIgnored, `console errors on /record: ${nonIgnored.join(", ")}`)
      .toEqual([]);
  });
});
