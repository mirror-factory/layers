/**
 * PROD-464 — citation pill click should scroll the transcript pane to the
 * matching `[data-segment="n"]` row and apply a transient `citation-flash`
 * highlight. The full functional chain (tab swap, scroll target, flash
 * class, removal after 1.5s) is covered deterministically in
 * `tests/unit/components/session-workspace-citation.test.tsx`.
 *
 * This visual spec is scaffolded for a future seeded meeting fixture where
 * the meeting detail page can be loaded with a known transcript + chat
 * response containing `[S1]`-style citations. Today there is no fixture
 * route that boots the page with a citing chat reply, so we keep this spec
 * skipped — flipping it on requires:
 *   1. A seeded meeting whose chat reply contains `[S2]` (and a transcript
 *      row at index 2 so the receiver has somewhere to scroll).
 *   2. Auth bypass for Playwright (or storage state) so the meeting page
 *      renders the `CompletedMeetingWorkspace`.
 *   3. The chat stream completes deterministically before the click.
 */
import { test, expect } from "@playwright/test";

test.skip("citation pill scrolls and flashes the cited transcript row", async ({
  page,
}) => {
  await page.goto("/meetings/seeded-meeting-with-citation");

  // The chat reply renders `[S2]` as a pill; click it.
  const citationPill = page.getByRole("button", {
    name: /Jump to transcript segment 2/i,
  });
  await citationPill.click();

  // Canvas should swap to the transcript tab.
  const transcriptTab = page.getByRole("tab", { name: /transcript/i });
  await expect(transcriptTab).toHaveAttribute("aria-selected", "true");

  // The target row picks up the citation-flash class for the duration of
  // the keyframe animation.
  const target = page.locator('[data-segment="2"]');
  await expect(target).toHaveClass(/citation-flash/);

  // After the flash duration the class is removed again so the row returns
  // to its resting state.
  await page.waitForTimeout(1800);
  await expect(target).not.toHaveClass(/citation-flash/);
});
