import { test, expect } from "@playwright/test";

test.describe("Customer OTP Login", () => {
  test("request OTP, see dev code, verify, reach logged-in state", async ({ page }) => {
    await page.goto("/customer/login");

    // Request OTP
    await page.fill('input[type="tel"]', "+15559990001");
    await page.getByRole("button", { name: "Send Code" }).click();

    // Dev OTP should appear in amber box
    await expect(page.getByText("Dev Mode")).toBeVisible({ timeout: 10_000 });
    // Extract OTP from the dev mode box (not from the phone number display)
    const devBox = page.getByText("Dev Mode").locator("..");
    const otpText = await devBox.locator("p").last().textContent();
    const otp = otpText?.replace(/\s+/g, "").match(/\d{6}/)?.[0];
    expect(otp).toBeTruthy();

    // Enter OTP
    await page.fill('input[placeholder="123456"]', otp!);
    await page.getByRole("button", { name: /Verify/ }).click();

    // Should redirect to /customer landing page after successful OTP
    await expect(page).toHaveURL(/\/customer(?!\/login)/, { timeout: 10_000 });
    await expect(page.getByText("Customer Ordering")).toBeVisible({ timeout: 5_000 });
  });
});
