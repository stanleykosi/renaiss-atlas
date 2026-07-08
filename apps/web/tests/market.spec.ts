import { expect, test } from "@playwright/test";

test("opens market pulse and search entry", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Renaiss OS Index Intelligence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured Movers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Trades" })).toBeVisible();
  await expect(page.getByPlaceholder("Search card, set, character, or cert target")).toBeVisible();
});
