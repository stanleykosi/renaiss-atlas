import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const renaissCharizardToken =
  "L2NhcmQvcG9rZW1vbi9wb2tlbW9uLWphcGFuZXNlLWNsbC10cmFkaW5nLWNhcmQtZ2FtZS1jbGFzc2ljLWNoYXJpemFyZC1oby1vaC1leC1kZWNrLzAwMy1jaGFyaXphcmQtcHNhLTEwLWphcGFuZXNlLTI4MDAwOTRm";

test.skip(process.env["CAPTURE_SCREENSHOTS"] !== "true", "Run pnpm screenshots to capture docs screenshots.");
test.setTimeout(300_000);

test("captures product screenshots for deployment docs", async ({ page }) => {
  await mkdir("docs/screenshots", { recursive: true });

  await page.goto("/market", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Renaiss OS Index Intelligence" })).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: "docs/screenshots/market.png", fullPage: true });

  await page.goto(`/cards/${renaissCharizardToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Charizard", exact: true })).toBeVisible({
    timeout: 120_000
  });
  await page.screenshot({ path: "docs/screenshots/card-detail.png", fullPage: true });
});
