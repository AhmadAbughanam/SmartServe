import { test, expect } from "@playwright/test";
import { createTestOrder } from "./helpers";

test.describe("Mock Online Payment", () => {
  test("create order, pay online, simulate success, see PAID", async ({ page }) => {
    const { sessionId, orderId } = await createTestOrder("T5");

    // Open order status page
    await page.goto(`/customer/session/${sessionId}/orders/${orderId}`);
    await expect(page.getByText("PLACED").first()).toBeVisible({ timeout: 10_000 });

    // Click Pay Online
    await page.getByRole("button", { name: /Pay Online/ }).click();

    // Should navigate to mock payment gateway page
    await page.waitForURL(/\/customer\/payment\/success/, { timeout: 10_000 });
    await expect(page.getByText("Mock Payment Gateway")).toBeVisible({ timeout: 10_000 });

    // Simulate payment success
    await page.getByRole("button", { name: /Simulate Payment Success/ }).click();
    await expect(page.getByText("Payment Completed!")).toBeVisible({ timeout: 10_000 });

    // Navigate back to order with fresh data load
    await page.goto(`/customer/session/${sessionId}/orders/${orderId}`);

    // Order should show PAID (wait for data refetch)
    await expect(page.getByText("Payment Complete").first()).toBeVisible({ timeout: 15_000 });
  });
});
