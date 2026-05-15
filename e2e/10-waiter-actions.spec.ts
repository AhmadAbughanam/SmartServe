import { test, expect } from "@playwright/test";
import { injectStaffAuth, apiPost, resetTablesAndSessions } from "./helpers";

test.describe("Waiter Service Request Actions", () => {
  test("claim and complete a service request", async ({ page }) => {
    // Create session + service request via API
    await resetTablesAndSessions();
    const session = await apiPost("/sessions/start", {
      branchId: "seed-branch-1", tableCode: "T3", guestCount: 1,
    });
    await apiPost(`/sessions/${session.id}/service-requests`, { type: "CALL_WAITER" });

    // Open waiter dashboard
    await injectStaffAuth(page, "waiter@demo.com");
    await page.goto("/waiter/dashboard");

    // Service request should appear
    await expect(page.getByText("CALL WAITER").first()).toBeVisible({ timeout: 10_000 });

    // Claim it
    await page.getByRole("button", { name: "Claim" }).first().click();

    // After claiming, should see Done button
    await expect(page.getByRole("button", { name: "Done" }).first()).toBeVisible({ timeout: 5_000 });

    // Complete it
    await page.getByRole("button", { name: "Done" }).first().click();

    // Switch to Done tab to verify it completed
    await page.getByRole("button", { name: "Done", exact: true }).first().click();
    await page.waitForTimeout(1_000);

    // The completed request should be visible somewhere
    const completedVisible = await page.getByText("COMPLETED").first().isVisible().catch(() => false);
    const allCaughtUp = await page.getByText("All caught up").isVisible().catch(() => false);
    // Either we see completed request or the active tab shows "all caught up"
    expect(completedVisible || allCaughtUp).toBe(true);
  });
});
