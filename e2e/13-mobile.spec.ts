import { test, expect } from "@playwright/test";
import { injectStaffAuth } from "./helpers";

test.describe("Mobile Viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test("customer start page renders on mobile", async ({ page }) => {
    await page.goto("/customer/start?branchId=seed-branch-1&tableCode=T1");
    await expect(page.getByRole("button", { name: "Start Ordering" })).toBeVisible();
    await expect(page.getByText("T1")).toBeVisible();
  });

  test("waiter dashboard renders on mobile", async ({ page }) => {
    await injectStaffAuth(page, "waiter@demo.com");
    await page.goto("/waiter/dashboard");
    await expect(page.getByText("T1").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Service Requests").first()).toBeVisible();
  });
});
