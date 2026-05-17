import { expect, test } from "@playwright/test";

const controlPlaneTabs = [
  { id: "overview", label: "Overview" },
  { id: "actions", label: "Actions" },
  { id: "runtimes", label: "Runtimes" },
  { id: "system", label: "System" },
  { id: "costs", label: "Costs" },
  { id: "proof", label: "Proof" },
  { id: "registries", label: "Registries" },
  { id: "handoff", label: "Handoff" },
] as const;

test("/control-plane renders every Starter Kit tab", async ({ page }) => {
  test.setTimeout(75_000);

  const response = await page.goto("/control-plane", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("tablist")).toBeVisible({ timeout: 30_000 });

  for (const { id, label } of controlPlaneTabs) {
    const tab = page.locator(`#control-plane-tab-button-${id}`);
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(label);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
});
