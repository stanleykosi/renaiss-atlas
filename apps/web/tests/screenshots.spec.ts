import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.skip(process.env["CAPTURE_SCREENSHOTS"] !== "true", "Run pnpm screenshots to capture docs screenshots.");
test.setTimeout(300_000);

test("captures product screenshots for deployment docs", async ({ page }) => {
  await mkdir("docs/screenshots", { recursive: true });

  await page.goto("/market", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Market Health Map" })).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: "docs/screenshots/market.png", fullPage: true });

  await page.goto("/cards/demo-card-001", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Pikachu Renaiss Demo PSA 10", exact: true })).toBeVisible({
    timeout: 120_000
  });
  await page.screenshot({ path: "docs/screenshots/card-detail.png", fullPage: true });

  await page.goto("/admin/sync", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sync Control" })).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: "docs/screenshots/admin-sync.png", fullPage: true });
});
