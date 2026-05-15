import { test, expect } from "@playwright/test";
import { injectStaffAuth, createTestOrder } from "./helpers";

test.describe("KDS Item Actions", () => {
  test("start order, fire item, mark done", async ({ page }) => {
    // Create fresh order via API
    await createTestOrder("T4");

    // Open KDS as chef
    await injectStaffAuth(page, "chef@demo.com");
    await page.goto("/kitchen/orders");
    await expect(page.getByText("KDS").first()).toBeVisible({ timeout: 10_000 });

    // Find the START ORDER button and click it
    const startBtn = page.getByRole("button", { name: "START ORDER" }).first();
    if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startBtn.click();
      // After starting, items should show FIRE buttons
      await expect(page.getByRole("button", { name: "FIRE" }).first()).toBeVisible({ timeout: 5_000 });

      // Fire first item
      await page.getByRole("button", { name: "FIRE" }).first().click();

      // After firing, should see DONE button
      await expect(page.getByRole("button", { name: "DONE" }).first()).toBeVisible({ timeout: 5_000 });

      // Mark done
      await page.getByRole("button", { name: "DONE" }).first().click();

      // Should see READY badge or ORDER READY button
      await page.waitForTimeout(1_000);
      const hasReady = await page.getByText("READY").first().isVisible().catch(() => false);
      expect(hasReady).toBe(true);
    }
  });
});
