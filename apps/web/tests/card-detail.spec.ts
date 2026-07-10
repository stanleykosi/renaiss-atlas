import { expect, test } from "@playwright/test";

const renaissCharizardToken =
  "L2NhcmQvcG9rZW1vbi9wb2tlbW9uLWphcGFuZXNlLWNsbC10cmFkaW5nLWNhcmQtZ2FtZS1jbGFzc2ljLWNoYXJpemFyZC1oby1vaC1leC1kZWNrLzAwMy1jaGFyaXphcmQtcHNhLTEwLWphcGFuZXNlLTI4MDAwOTRm";

test("opens card intelligence", async ({ page }) => {
  await page.goto(`/cards/${renaissCharizardToken}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Charizard", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Price Panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atlas Scores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Graded Cert Lookup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate Collector Brief" })).toBeVisible();
});

test("shows a not-found state for an unsupported card token", async ({ page }) => {
  await page.goto("/cards/not-a-renaiss-card-token");

  await expect(page.getByRole("heading", { name: "Card not found." })).toBeVisible({
    timeout: 15_000
  });
});
