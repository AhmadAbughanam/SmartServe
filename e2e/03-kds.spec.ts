import { test, expect } from "@playwright/test";
import { injectStaffAuth } from "./helpers";

test.describe("KDS Kitchen Display", () => {
  test("chef views KDS queue", async ({ page }) => {
    await injectStaffAuth(page, "chef@demo.com");
    await page.goto("/kitchen/orders");

    await expect(page.getByText("KDS").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Live").first()).toBeVisible();
    await expect(page.getByText("NEW").first()).toBeVisible();
    await expect(page.getByText("COOKING").first()).toBeVisible();
  });

  test("waiter can view KDS (has kds:read)", async ({ page }) => {
    await injectStaffAuth(page, "waiter@demo.com");
    await page.goto("/kitchen/orders");
    await expect(page.getByText("KDS").first()).toBeVisible({ timeout: 10_000 });
  });
});
