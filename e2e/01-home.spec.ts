import { test, expect } from "@playwright/test";

test.describe("Home / Demo Hub", () => {
  test("displays surface cards and demo credentials", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Smart Restaurant OS").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customer Ordering" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kitchen Display" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiter Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin & POS" })).toBeVisible();
    await expect(page.getByText("owner@demo.com")).toBeVisible();
    await expect(page.getByText("password123")).toBeVisible();
  });

  test("customer link navigates to start", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Try Customer Ordering" }).click();
    await expect(page).toHaveURL(/\/customer\/start/);
  });
});
