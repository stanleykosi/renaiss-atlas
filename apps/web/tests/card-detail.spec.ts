import { expect, test } from "@playwright/test";

test("opens a seeded card detail page", async ({ page }) => {
  await page.goto("/cards/demo-card-001", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Pikachu Renaiss Demo PSA 10", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended Actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External Comps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bundles" })).toBeVisible();
  await expect(page.getByText(/Sequential cert pair/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intents" })).toBeVisible();
  await expect(page.getByText(/Seller demand:/)).toBeVisible();
  await expect(page.getByText("Informational only.")).toBeVisible();
});

test("shows seller demand on an intent-matched card", async ({ page }) => {
  await page.goto("/cards/demo-card-005", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Nami Renaiss Demo Intent Match", exact: true })).toBeVisible();
  await expect(page.getByText("Seller demand: 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intents" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Looking for PSA 10 Japanese One Piece cards under $150.",
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByText("TCG match").first()).toBeVisible();
});

test("shows the card detail empty state for an unknown token", async ({ page }) => {
  await page.goto("/cards/not-a-seeded-card");

  await expect(page.getByRole("heading", { name: "Card not found." })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Return to market" })).toBeVisible();
});
