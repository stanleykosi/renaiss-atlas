import { expect, test } from "@playwright/test";

test("opens seeded wallet copilot with read-only actions", async ({ page }) => {
  await page.goto("/wallet/0x1111111111111111111111111111111111111111");

  await expect(page.getByRole("heading", { name: "Wallet Copilot" })).toBeVisible();
  await expect(page.getByText("Read only").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ranked Action Plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holdings" }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bundle Opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intent Matches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Share Summary Card" })).toBeVisible();
  await expect(page.getByText(/Pikachu Renaiss Demo PSA 10/).first()).toBeVisible();
  await expect(page.getByText(/no signatures/i)).toBeVisible();
});

test("shows a friendly invalid wallet state", async ({ page }) => {
  await page.goto("/wallet/not-an-address");

  await expect(page.getByRole("heading", { name: "Invalid wallet address" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open demo wallet" })).toBeVisible();
  await expect(page.getByText(/do not request signatures/i)).toBeVisible();
});
