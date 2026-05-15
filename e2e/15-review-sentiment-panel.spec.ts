import { test, expect } from "@playwright/test";

const menu = [
  {
    id: "cat-main",
    name: "Mains",
    description: null,
    displayOrder: 1,
    menuItems: [
      {
        id: "item-burger",
        name: "Classic Burger",
        description: "Beef burger",
        price: "14.00",
        dietaryInfo: null,
        allergensJson: [],
        isVegetarian: false,
        isSpicy: false,
        prepTimeMinutes: 15,
        imageUrl: null,
        isUnavailable: false,
        isActive: true,
        additions: [],
      },
      {
        id: "item-pasta",
        name: "Spaghetti Carbonara",
        description: "Pasta",
        price: "12.00",
        dietaryInfo: null,
        allergensJson: [],
        isVegetarian: false,
        isSpicy: false,
        prepTimeMinutes: 12,
        imageUrl: null,
        isUnavailable: false,
        isActive: true,
        additions: [],
      },
    ],
  },
];

const dashboard = {
  totalSales: "1200.00",
  netSales: "1150.00",
  totalOrders: 42,
  averageOrderValue: "27.38",
  activeSessions: 3,
  completedSessions: 20,
  averageSessionMinutes: 48,
  totalExpenses: "300.00",
  estimatedProfit: "850.00",
  totalRefunds: "50.00",
  cancelledOrders: 1,
  openServiceRequests: 2,
  tables: { AVAILABLE: 3, OCCUPIED: 2, CLEANING: 1 },
};

const sentiment = {
  branchId: "seed-branch-1",
  from: "2026-05-01",
  to: "2026-05-07",
  totalReviews: 28,
  averageRating: 3.7,
  sentiment: "MIXED",
  summary:
    "Customer feedback is mixed for this period. Average rating is 3.7 across 28 reviews. The most common issues are late and cold. Mostly affecting Classic Burger and Spaghetti Carbonara.",
  commonIssues: [
    { issue: "late", count: 8, severity: "MEDIUM" },
    { issue: "cold", count: 3, severity: "LOW" },
  ],
  affectedItems: [
    {
      menuItemId: "item-burger",
      name: "Classic Burger",
      averageRating: 3.1,
      issueCount: 8,
      topIssue: "late",
    },
    {
      menuItemId: "item-pasta",
      name: "Spaghetti Carbonara",
      averageRating: 3.4,
      issueCount: 3,
      topIssue: "cold",
    },
  ],
  trend: {
    previousFrom: "2026-04-24",
    previousTo: "2026-04-30",
    previousTotalReviews: 18,
    previousAverageRating: 3.2,
    averageRatingDelta: 0.5,
    reviewCountDelta: 10,
    currentTopIssue: "late",
    previousTopIssue: "cold",
    topIssueChanged: true,
    direction: "IMPROVING",
  },
  alerts: [
    {
      type: "ISSUE_SPIKE",
      severity: "HIGH",
      issue: "late",
      currentCount: 8,
      previousCount: 2,
      countDelta: 6,
      message: "late complaints increased by 6 versus the previous period.",
    },
  ],
  itemTimelines: [
    {
      menuItemId: "item-burger",
      name: "Classic Burger",
      totalIssueCount: 11,
      direction: "WORSENING",
      points: [
        {
          from: "2026-05-01",
          to: "2026-05-02",
          reviewCount: 4,
          averageRating: 3.8,
          issueCount: 2,
          topIssue: "cold",
        },
        {
          from: "2026-05-03",
          to: "2026-05-04",
          reviewCount: 5,
          averageRating: 3.4,
          issueCount: 3,
          topIssue: "late",
        },
        {
          from: "2026-05-05",
          to: "2026-05-06",
          reviewCount: 6,
          averageRating: 3.0,
          issueCount: 6,
          topIssue: "late",
        },
        {
          from: "2026-05-07",
          to: "2026-05-07",
          reviewCount: 2,
          averageRating: 2.8,
          issueCount: 5,
          topIssue: "late",
        },
      ],
    },
  ],
  operationalCorrelations: {
    reviewedOrderCount: 28,
    lateIssueReviewCount: 8,
    averageKitchenMinutes: 21.5,
    lateReviewsAverageKitchenMinutes: 31.5,
    averageReadyToServedMinutes: 6.2,
    lateReviewsAverageReadyToServedMinutes: 9.4,
    serviceRequestCount: 12,
    lateReviewsServiceRequestCount: 6,
    signal: "KITCHEN_DELAY",
    summary: "Operational correlation: late-complaint orders averaged 31.5 kitchen minutes.",
  },
};

async function seedAdminStorage(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("staff_token", "e2e-token");
    localStorage.setItem("staff_branch_id", "seed-branch-1");
    localStorage.setItem("admin_selected_branch", "seed-branch-1");
    localStorage.setItem("staff_name", "Owner Admin");
    localStorage.setItem("staff_role", "OWNER");
  });
}

async function mockAdminAnalytics(page: import("@playwright/test").Page) {
  await page.route("**/api/admin/branches", async (route) => {
    await route.fulfill({
      json: [
        {
          id: "seed-branch-1",
          name: "Downtown Branch",
          location: "123 Main Street",
          isActive: true,
        },
      ],
    });
  });

  await page.route("**/api/menu?branchId=seed-branch-1", async (route) => {
    await route.fulfill({ json: menu });
  });

  await page.route("**/api/analytics/dashboard?branchId=seed-branch-1", async (route) => {
    await route.fulfill({ json: dashboard });
  });

  await page.route("**/api/analytics/sales?branchId=seed-branch-1", async (route) => {
    await route.fulfill({
      json: {
        grossSales: "1200.00",
        refunds: "50.00",
        netSales: "1150.00",
        tips: "80.00",
        paymentCount: 20,
        orderCount: 42,
        averageOrderValue: "27.38",
        byPaymentMethod: [{ method: "CARD", total: "900.00", count: 16 }],
      },
    });
  });

  await page.route("**/api/analytics/menu-performance?branchId=seed-branch-1", async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            menuItemId: "item-burger",
            name: "Classic Burger",
            category: "Mains",
            quantitySold: 20,
            revenue: "280.00",
          },
        ],
      },
    });
  });

  await page.route("**/api/analytics/insights?branchId=seed-branch-1", async (route) => {
    await route.fulfill({
      json: {
        kitchen: { avgPrepTimeMinutes: 14, itemsCooked: 44, currentDelayedOrders: 1 },
        menu: { topSellers: [] },
        staff: { performance: [], serviceRequestsHandled: [] },
        tables: { insights: [] },
        reviews: { avgRating: 3.7, totalReviews: 28, topComplaints: [{ tag: "LATE", count: 8 }] },
        operations: { openLowStockAlerts: 0 },
      },
    });
  });

  await page.route("**/api/admin/ai/demand-forecast?**", async (route) => {
    await route.fulfill({
      json: {
        branchId: "seed-branch-1",
        forecastDate: "2026-05-05",
        lookbackDays: 30,
        expectedOrders: 12,
        expectedRevenue: 300,
        items: [],
        hourlyDemand: [],
      },
    });
  });
}

test.describe("Review Sentiment Panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAnalytics(page);
    await seedAdminStorage(page);
  });

  test("renders controls, summary cards, issues, affected items, and insight", async ({ page }) => {
    let requestedUrl = "";

    await page.route("**/api/admin/ai/review-sentiment?**", async (route) => {
      requestedUrl = route.request().url();
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({ json: sentiment });
    });

    await page.goto("/admin/analytics");

    await expect(page.getByTestId("review-sentiment-panel")).toBeVisible();
    await expect(page.getByTestId("review-sentiment-from")).toBeVisible();
    await expect(page.getByTestId("review-sentiment-to")).toBeVisible();
    await expect(page.getByTestId("review-sentiment-menu-item")).toContainText("Classic Burger");
    await expect(page.getByTestId("review-sentiment-loading")).toBeVisible();

    await expect(page.getByTestId("review-sentiment-cards")).toContainText("28");
    await expect(page.getByTestId("review-sentiment-cards")).toContainText("3.70");
    await expect(page.getByTestId("review-sentiment-cards")).toContainText("+0.50 rating");
    await expect(page.getByTestId("review-sentiment-summary")).toContainText("Customer feedback is mixed");
    await expect(page.getByTestId("review-sentiment-insight")).toContainText("late");
    await expect(page.getByTestId("review-sentiment-trend")).toContainText("IMPROVING");
    await expect(page.getByTestId("review-sentiment-trend")).toContainText("Top issue changed from cold to late");
    await expect(page.getByTestId("review-sentiment-alerts")).toContainText("late complaints increased by 6");
    await expect(page.getByTestId("review-sentiment-alerts")).toContainText("HIGH");
    await expect(page.getByTestId("review-sentiment-item-timelines")).toContainText("Classic Burger");
    await expect(page.getByTestId("review-sentiment-item-timelines")).toContainText("WORSENING");
    await expect(page.getByTestId("review-sentiment-item-timelines")).toContainText("2026-05-07 to 2026-05-07");
    await expect(page.getByTestId("review-sentiment-operational-correlations")).toContainText("KITCHEN DELAY");
    await expect(page.getByTestId("review-sentiment-operational-correlations")).toContainText("31.5m");
    await expect(page.getByTestId("review-sentiment-common-issues")).toContainText("late");
    await expect(page.getByTestId("review-sentiment-common-issues")).toContainText("MEDIUM");
    await expect(page.getByTestId("review-sentiment-affected-items")).toContainText("Classic Burger");
    await expect(page.getByTestId("review-sentiment-affected-items")).toContainText("Spaghetti Carbonara");

    expect(requestedUrl).toContain("branchId=seed-branch-1");
    expect(requestedUrl).toContain("from=");
    expect(requestedUrl).toContain("to=");

    await page.getByTestId("review-sentiment-menu-item").selectOption("item-burger");
    await expect.poll(() => requestedUrl).toContain("menuItemId=item-burger");
  });

  test("shows empty state when no reviews are returned", async ({ page }) => {
    await page.route("**/api/admin/ai/review-sentiment?**", async (route) => {
      await route.fulfill({
        json: {
          branchId: "seed-branch-1",
          from: "2026-05-01",
          to: "2026-05-07",
          totalReviews: 0,
          averageRating: 0,
          sentiment: "NEUTRAL",
          summary: "No customer reviews were found for this period.",
          commonIssues: [],
          affectedItems: [],
          trend: {
            previousFrom: "2026-04-24",
            previousTo: "2026-04-30",
            previousTotalReviews: 0,
            previousAverageRating: 0,
            averageRatingDelta: 0,
            reviewCountDelta: 0,
            topIssueChanged: false,
            direction: "NO_PRIOR_DATA",
          },
          alerts: [],
          itemTimelines: [],
          operationalCorrelations: {
            reviewedOrderCount: 0,
            lateIssueReviewCount: 0,
            averageKitchenMinutes: null,
            lateReviewsAverageKitchenMinutes: null,
            averageReadyToServedMinutes: null,
            lateReviewsAverageReadyToServedMinutes: null,
            serviceRequestCount: 0,
            lateReviewsServiceRequestCount: 0,
            signal: "NONE",
            summary: "No late-complaint correlation was detected for this period.",
          },
        },
      });
    });

    await page.goto("/admin/analytics");

    await expect(page.getByTestId("review-sentiment-summary")).toContainText(
      "No customer reviews were found",
    );
    await expect(page.getByTestId("review-sentiment-empty")).toContainText(
      "No reviews were found",
    );
  });

  test("shows error state when the sentiment API fails", async ({ page }) => {
    await page.route("**/api/admin/ai/review-sentiment?**", async (route) => {
      await route.fulfill({ status: 500, json: { message: "failed" } });
    });

    await page.goto("/admin/analytics");

    await expect(page.getByTestId("review-sentiment-error")).toContainText(
      "Review sentiment unavailable",
    );
  });
});
