import { expect, test } from "@playwright/test";

test("opens bundle explorer with seeded deterministic bundles", async ({ page }) => {
  await page.goto("/bundles");

  await expect(page.getByRole("heading", { name: "Bundle Explorer" })).toBeVisible();
  await expect(page.getByText(/Sequential cert pair/)).toBeVisible();
  await expect(page.getByText(/Pikachu character bundle/)).toBeVisible();
  await expect(page.getByText("same wallet").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Pikachu Renaiss Demo PSA 10/ }).first()).toBeVisible();
});
