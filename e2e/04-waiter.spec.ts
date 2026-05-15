import { test, expect } from "@playwright/test";
import { injectStaffAuth } from "./helpers";

test.describe("Waiter Dashboard", () => {
  test("waiter dashboard loads with tables and service requests", async ({ page }) => {
    await injectStaffAuth(page, "waiter@demo.com");
    await page.goto("/waiter/dashboard");

    await expect(page.getByText("Occupied").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("T1").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Service Requests").first()).toBeVisible();
  });

  test("unauthenticated redirects to login", async ({ page }) => {
    await page.goto("/waiter/dashboard");
    await page.waitForURL(/\/waiter\/login/, { timeout: 5_000 });
  });
});
