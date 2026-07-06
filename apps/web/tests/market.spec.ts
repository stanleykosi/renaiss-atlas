import { expect, test } from "@playwright/test";

test("opens market and filters seeded cards", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Market Health Map" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toBeVisible();
  await expect(page.getByLabel("Search cards")).toBeEnabled({ timeout: 30_000 });

  await page.getByLabel("Search cards").fill("Charizard");
  await expect(page.getByLabel("Search cards")).toHaveValue("Charizard");
  const charizardRow = page.getByRole("row", { name: /Charizard Renaiss Demo Under FMV/ });
  await expect(charizardRow).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toHaveCount(0);

  await charizardRow.click();
  await expect(page.getByRole("dialog")).toContainText("Charizard Renaiss Demo Under FMV");
});
