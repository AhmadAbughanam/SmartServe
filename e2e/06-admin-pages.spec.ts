import { test, expect } from "@playwright/test";
import { injectStaffAuth } from "./helpers";

test.describe("Admin Pages", () => {
  test.beforeEach(async ({ page }) => {
    await injectStaffAuth(page, "owner@demo.com");
  });

  test("menu page loads", async ({ page }) => {
    await page.goto("/admin/menu");
    await expect(page.getByText("Menu Management")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Classic Burger").first()).toBeVisible({ timeout: 10_000 });
  });

  test("staff page loads", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page.getByRole("main").getByText("Owner Admin")).toBeVisible({ timeout: 10_000 });
  });

  test("analytics page loads", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page.getByText("Net Sales").first()).toBeVisible({ timeout: 10_000 });
  });

  test("inventory page loads", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(page.getByText("Beef Patty").first()).toBeVisible({ timeout: 10_000 });
  });

  test("promotions page loads", async ({ page }) => {
    await page.goto("/admin/promotions");
    await expect(page.getByRole("heading", { name: "Promotions" })).toBeVisible({ timeout: 10_000 });
  });
});
