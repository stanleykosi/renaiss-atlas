import { expect, test } from "@playwright/test";

test("opens intents and creates a deterministic preview match", async ({ page }) => {
  await page.goto("/intents", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Intent Board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Intent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deterministic Matches" })).toBeVisible();
  await expect(page.getByText("Nami Renaiss Demo Intent Match")).toBeVisible();
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Intent text").fill("Looking for Charizard PSA 10 under $200.");
  await expect(page.getByLabel("Intent text")).toHaveValue("Looking for Charizard PSA 10 under $200.");
  await page.getByLabel("Character").fill("Charizard");
  await page.getByLabel("Max price").fill("200");
  const createResponse = page.waitForResponse(
    (response) => response.url().includes("/api/intents") && response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "Create intent" }).click();

  await expect((await createResponse).status()).toBe(201);
  await expect(page.getByText(/Intent preview generated|Intent saved/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Looking for Charizard PSA 10 under $200.")).toBeVisible();
});
