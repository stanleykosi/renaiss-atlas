import { expect, test } from "@playwright/test";

test("home scaffold renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Renaiss Atlas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open market map" })).toBeVisible();
});
