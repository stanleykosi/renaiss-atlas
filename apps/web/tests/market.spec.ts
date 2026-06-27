import { expect, test } from "@playwright/test";

test("opens market and filters seeded cards", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/market");

  await expect(page.getByRole("heading", { name: "Market Health Map" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toBeVisible();

  await page.getByLabel("Search cards").fill("Charizard");
  const charizardRow = page.getByRole("row", { name: /Charizard Renaiss Demo Under FMV/ });
  await expect(charizardRow).toBeVisible();
  await expect(page.getByRole("row", { name: /Pikachu Renaiss Demo PSA 10/ })).toHaveCount(0);

  await charizardRow.click();
  await expect(page.getByRole("dialog")).toContainText("Charizard Renaiss Demo Under FMV");
});
