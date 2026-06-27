import { expect, test } from "@playwright/test";

test("opens a seeded card detail page", async ({ page }) => {
  await page.goto("/cards/demo-card-001");

  await expect(page.getByRole("heading", { name: "Pikachu Renaiss Demo PSA 10", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended Actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External Comps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bundles" })).toBeVisible();
  await expect(page.getByText(/Sequential cert pair/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intents" })).toBeVisible();
  await expect(page.getByText("Informational only.")).toBeVisible();
});

test("shows the card detail empty state for an unknown token", async ({ page }) => {
  await page.goto("/cards/not-a-seeded-card");

  await expect(page.getByRole("heading", { name: "Card not found." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to market" })).toBeVisible();
});
