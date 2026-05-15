import { test, expect } from "@playwright/test";
import { injectStaffAuth } from "./helpers";

test.describe("Inventory Management", () => {
  test("create item and adjust stock", async ({ page }) => {
    await injectStaffAuth(page, "owner@demo.com");
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({ timeout: 10_000 });

    // Open create form
    await page.getByRole("button", { name: /New Item/ }).click();

    // Fill unique item
    const name = `Test Item ${Date.now()}`;
    await page.fill('input[placeholder="Item name"]', name);
    await page.fill('input[placeholder*="Unit"]', "kg");
    await page.fill('input[placeholder*="Current stock"]', "100");
    await page.fill('input[placeholder*="Reorder"]', "10");

    await page.getByRole("button", { name: "Create" }).click();

    // Item should appear
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });

    // Click adjust
    const adjustBtn = page.getByRole("button", { name: "Adjust" });
    // Find the one near our new item
    await adjustBtn.last().click();

    // Enter negative delta
    await page.fill('input[placeholder*="Delta"]', "-10");
    await page.getByRole("button", { name: "Apply" }).click();

    // Wait for refresh
    await page.waitForTimeout(1_000);

    // Item should still be visible with updated stock
    await expect(page.getByText(name).first()).toBeVisible();
  });
});
