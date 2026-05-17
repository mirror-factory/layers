import { expect, test } from "@playwright/test";

const devKitTabs = [
  { label: "Overview", path: "/dev-kit" },
  { label: "Project", path: "/dev-kit/project" },
  { label: "Proof", path: "/dev-kit/proof" },
  { label: "Runs", path: "/dev-kit/runs" },
  { label: "Sessions", path: "/dev-kit/sessions" },
  { label: "Registries", path: "/dev-kit/registries" },
  { label: "Design system", path: "/dev-kit/design-system" },
  { label: "Config", path: "/dev-kit/config" },
  { label: "Status", path: "/dev-kit/status" },
  { label: "Tools", path: "/dev-kit/tools" },
  { label: "Evaluations", path: "/dev-kit/evals" },
  { label: "Cost", path: "/dev-kit/cost" },
  { label: "Deployments", path: "/dev-kit/deployments" },
  { label: "Regressions", path: "/dev-kit/regressions" },
  { label: "Connectors", path: "/dev-kit/connectors" },
  { label: "Coverage", path: "/dev-kit/coverage" },
] as const;

for (const tab of devKitTabs) {
  test(`/dev-kit tab renders: ${tab.label}`, async ({ page }) => {
    const response = await page.goto(tab.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${tab.path} should return HTTP 200`).toBe(200);

    await expect(page.getByRole("link", { name: tab.label })).toBeVisible();
    await expect(page.getByRole("main").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/404|not found/i);
  });
}
