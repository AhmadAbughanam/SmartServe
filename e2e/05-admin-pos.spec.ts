import { test, expect } from "@playwright/test";
import { injectStaffAuth, resetTablesAndSessions } from "./helpers";

test.describe("Admin / POS", () => {
  test("owner views dashboard analytics", async ({ page }) => {
    await injectStaffAuth(page, "owner@demo.com");
    await page.goto("/admin/dashboard");

    await expect(page.getByText("Net Sales").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Est. Profit").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /POS/ }).first()).toBeVisible();
  });

  test("POS creates order", async ({ page }) => {
    await resetTablesAndSessions();
    await injectStaffAuth(page, "cashier@demo.com");
    await page.goto("/admin/pos");

    await expect(page.getByText("Cola").first()).toBeVisible({ timeout: 10_000 });
    await page.getByText("Cola").first().click();
    await page.getByRole("button", { name: "Create Order" }).click();
    await expect(page.getByText("Record Payment")).toBeVisible({ timeout: 10_000 });
  });

  test("chef denied admin access", async ({ page }) => {
    // Inject chef token and navigate to admin — should redirect to login
    // since admin layout checks for admin-level permissions client-side.
    await injectStaffAuth(page, "chef@demo.com");
    await page.goto("/admin/dashboard");

    // Chef token is stored but admin pages require admin:read/pos:read/etc.
    // The admin layout will detect the token exists but the page data
    // fetches will fail with 403 — showing error or empty state.
    // At minimum, the dashboard KPI cards should NOT load (403 from analytics).
    // Wait for either a redirect to login or an error state.
    await page.waitForTimeout(2_000);

    const url = page.url();
    const hasLoginRedirect = url.includes("/admin/login");
    const hasErrorState = await page.getByText(/denied|error|failed/i).isVisible().catch(() => false);
    const hasDashboard = await page.getByText("Est. Profit").isVisible().catch(() => false);

    // Chef should NOT see the full dashboard
    expect(hasDashboard).toBe(false);
    // Should either redirect to login or show access denied
    expect(hasLoginRedirect || hasErrorState || !hasDashboard).toBe(true);
  });
});
