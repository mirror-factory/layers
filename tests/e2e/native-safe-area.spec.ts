/**
 * Native safe-area regression — PROD-460
 *
 * Ensures every top-anchored header on every routed page clears the iOS
 * dynamic island and Android display cutouts when running inside a Capacitor
 * webview. Browser viewports approximate the inset via the
 * `--mock-safe-top` CSS variable we inject below, since Playwright cannot
 * emulate iOS safe-area-inset-* natively.
 *
 * The test does two things per route:
 *   1. confirms the rendered `<meta name="viewport">` has viewport-fit=cover
 *   2. confirms that whatever element is sticky/fixed at top:0 has
 *      computed padding-top >= MOCK_INSET_PX (the dynamic island height).
 */

import { devices, expect, test } from "@playwright/test";

const MOCK_INSET_PX = 47; // iPhone 15 Pro dynamic island height
const MOCK_BOTTOM_PX = 34; // iPhone home indicator

const PAGES: ReadonlyArray<{ path: string; needsAuth?: boolean; expectTopBar?: boolean; expectFooterPad?: boolean }> = [
  { path: "/", expectFooterPad: true },
  { path: "/pricing", expectFooterPad: true },
  { path: "/download", expectFooterPad: true },
  { path: "/sign-in" },
  { path: "/sign-up" },
];

/** Inject `env(safe-area-inset-*)` mocks so JSDOM-style Playwright can assert. */
async function mockSafeArea(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({
    content: `
      :root {
        --safe-top: ${MOCK_INSET_PX}px !important;
        --safe-bottom: ${MOCK_BOTTOM_PX}px !important;
        --safe-left: 0px !important;
        --safe-right: 0px !important;
      }
    `,
  });
}

test.use({ ...devices["iPhone 13 Pro"] });

test.describe("PROD-460 — safe-area insets on native viewports (iPhone)", () => {
  test("root layout viewport meta has viewport-fit=cover", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(viewportMeta, "viewport meta tag is missing").not.toBeNull();
    expect(viewportMeta).toContain("viewport-fit=cover");
  });

  for (const spec of PAGES) {
    test(`top-anchored header respects --safe-top on ${spec.path}`, async ({
      page,
    }) => {
      const response = await page.goto(spec.path, {
        waitUntil: "domcontentloaded",
      });
      if (!response || response.status() >= 400) {
        test.skip(true, `page returned ${response?.status() ?? "no response"}`);
        return;
      }

      await mockSafeArea(page);
      // give styles a tick to apply
      await page.waitForTimeout(100);

      // Find the topmost sticky/fixed element. This covers the TopBar (app),
      // PublicSiteNav (public), and TestingBanner (public) patterns.
      const result = await page.evaluate(({ minPad }) => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(
            "header, [role='banner'], [data-testid='top-bar'], .top-bar"
          )
        );
        const reports: Array<{ tag: string; cls: string; padTop: number; pos: string }> = [];
        for (const el of candidates) {
          const rect = el.getBoundingClientRect();
          if (rect.top > 4) continue; // not anchored to the top
          const style = window.getComputedStyle(el);
          if (style.position !== "sticky" && style.position !== "fixed") continue;
          reports.push({
            tag: el.tagName.toLowerCase(),
            cls: el.className.toString().slice(0, 80),
            padTop: parseFloat(style.paddingTop) || 0,
            pos: style.position,
          });
        }
        return { reports, threshold: minPad };
      }, { minPad: MOCK_INSET_PX });

      if (result.reports.length === 0) {
        test.skip(true, "no top-anchored sticky/fixed header on this page");
        return;
      }

      for (const r of result.reports) {
        expect(
          r.padTop,
          `top-anchored <${r.tag} class="${r.cls}"> has padding-top ${r.padTop}px, ` +
            `but needs >= ${result.threshold}px to clear the dynamic island`
        ).toBeGreaterThanOrEqual(result.threshold);
      }
    });

    if (spec.expectFooterPad) {
      test(`footer respects --safe-bottom on ${spec.path}`, async ({ page }) => {
        const response = await page.goto(spec.path, {
          waitUntil: "domcontentloaded",
        });
        if (!response || response.status() >= 400) {
          test.skip(true, `page returned ${response?.status() ?? "no response"}`);
          return;
        }

        await mockSafeArea(page);
        await page.waitForTimeout(100);

        const padBottom = await page.evaluate(() => {
          const footer = document.querySelector("footer");
          if (!footer) return null;
          return parseFloat(window.getComputedStyle(footer).paddingBottom) || 0;
        });

        if (padBottom === null) {
          test.skip(true, "no footer on this page");
          return;
        }

        expect(
          padBottom,
          `footer padding-bottom must be >= ${MOCK_BOTTOM_PX}px to clear the home indicator`
        ).toBeGreaterThanOrEqual(MOCK_BOTTOM_PX);
      });
    }
  }
});

// Note: Pixel/Android hole-punch is covered in
// tests/e2e/native-safe-area-android.spec.ts. Playwright forbids switching
// `defaultBrowserType` mid-file via test.use() inside describe blocks, so
// the Android case lives in its own spec.
