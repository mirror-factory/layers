import { test, expect } from "@playwright/test";

test("app/download/page.tsx shows launch-ready channel states", async ({
  page,
}) => {
  await page.goto("/download");

  await expect(
    page.getByRole("heading", {
      name: /Wherever your meetings happen,\s*Layers is quietly listening\./,
    }),
  ).toBeVisible();
  await expect(page.getByText("Stable alpha").first()).toBeVisible();
  await expect(page.getByText("macOS").first()).toBeVisible();
  await expect(page.getByText("Windows").first()).toBeVisible();
  await expect(page.getByText("Web app").first()).toBeVisible();
  await expect(page.getByText("Release line").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Web app" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "macOS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Windows" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "iPhone & iPad", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Android" }).first()).toBeVisible();

  await expect(page.getByText("macOS 13 Ventura or later")).toBeVisible();
  await expect(
    page.getByText("Windows 10 (build 19041) or Windows 11").first(),
  ).toBeVisible();

  await expect(
    page.locator('a[href*="apps.apple.com/us/search"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href*="play.google.com/store/search"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Open the web app/ }).first(),
  ).toBeVisible();
});

test("app/download/page.tsx remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/download");

  await expect(
    page.getByRole("link", { name: /Open the web app/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "iPhone & iPad", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("TestFlight invite — opening soon").first(),
  ).toBeVisible();
});
