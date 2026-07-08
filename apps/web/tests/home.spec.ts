import { expect, test } from "@playwright/test";

test("home renders", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Renaiss Atlas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open market pulse" })).toBeVisible();
});
