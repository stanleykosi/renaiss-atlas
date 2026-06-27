import { expect, test } from "@playwright/test";

test("opens market and filters seeded cards", async ({ page }) => {
  await page.goto("/market");

  await expect(page.getByRole("heading", { name: "Market Health Map" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toBeVisible();

  await page.getByLabel("Search cards").fill("Charizard");
  await expect(page.getByRole("row", { name: /Charizard Renaiss Demo Under FMV/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toHaveCount(0);

  await page.getByRole("row", { name: /Charizard Renaiss Demo Under FMV/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Charizard Renaiss Demo Under FMV");
});
