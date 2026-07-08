import { expect, test } from "@playwright/test";

const officialCharizardToken =
  "L2NhcmQvcG9rZW1vbi9wb2tlbW9uLWphcGFuZXNlLWNsbC10cmFkaW5nLWNhcmQtZ2FtZS1jbGFzc2ljLWNoYXJpemFyZC1oby1vaC1leC1kZWNrLzAwMy1jaGFyaXphcmQtcHNhLTEwLWphcGFuZXNlLTI4MDAwOTRm";

test("opens official card intelligence", async ({ page }) => {
  await page.goto(`/cards/${officialCharizardToken}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Charizard", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Official Price Panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atlas Scores From Official Evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source Breakdown" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Graded Cert Lookup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Deal Memo" })).toBeVisible();
});

test("shows a not-found state for an unsupported card token", async ({ page }) => {
  await page.goto("/cards/not-an-official-card-token");

  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible({ timeout: 15_000 });
});
