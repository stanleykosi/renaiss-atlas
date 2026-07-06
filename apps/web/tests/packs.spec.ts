import { expect, test } from "@playwright/test";

test("opens pack momentum with seeded pulls and odds disclaimer", async ({ page }) => {
  await page.goto("/packs", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Pack Momentum" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RenaCrypt Pack" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OMEGA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tier Distribution" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed Intervals" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Pulls" }).first()).toBeVisible();
  await expect(page.getByText(/not official odds/i)).toBeVisible();
  await expect(page.getByText(/mock data/i).first()).toBeVisible();
});
