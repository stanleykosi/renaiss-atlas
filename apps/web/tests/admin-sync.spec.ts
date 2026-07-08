import { expect, test } from "@playwright/test";

test("opens sync admin dashboard with seed warnings and job locks", async ({ page }) => {
  await page.goto("/admin/sync", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Sync Control" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Worker Jobs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data-Quality Warnings" })).toBeVisible();
  await expect(page.getByText("Renaiss marketplace")).toBeVisible();
  await expect(page.getByText("pnpm jobs:sync:renaiss")).toBeVisible();
  await expect(page.getByText("demo_seed_mode")).toBeVisible();
  await expect(page.getByRole("link", { name: "Readiness JSON" })).toBeVisible();
});
