import { test, expect } from "@playwright/test";
import { resetTablesAndSessions } from "./helpers";

test.describe("Customer Order Flow", () => {
  test.beforeAll(async () => { await resetTablesAndSessions(); });

  test("start session, browse menu, add to cart, place order", async ({ page }) => {
    await page.goto("/customer/start?branchId=seed-branch-1&tableCode=T4");
    await page.getByRole("button", { name: "Start Ordering" }).click();
    await page.waitForURL(/\/menu$/);

    await page.getByRole("button", { name: /^Cola/ }).first().click();
    await page.getByRole("button", { name: /Add to Cart/ }).click();
    await page.getByRole("button", { name: /View Cart/ }).click();
    await page.waitForURL(/\/cart$/);
    await page.getByRole("button", { name: /Place Order/ }).click();
    await page.waitForURL(/\/orders\//);

    await expect(page.getByText("PLACED").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Receipt")).toBeVisible();
  });
});
