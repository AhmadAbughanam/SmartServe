import { test, expect } from "@playwright/test";

/**
 * Single browser-form login test.
 * Only one API login call — stays safely under rate limit.
 */
test.describe("Login Form", () => {
  test("admin login form works and redirects to dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: /Admin/ })).toBeVisible();

    await page.fill('input[type="email"]', "owner@demo.com");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10_000 });
  });
});
