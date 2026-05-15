import { test, expect } from "@playwright/test";

const menu = [
  {
    id: "cat-main",
    name: "Mains",
    description: null,
    displayOrder: 1,
    menuItems: [
      {
        id: "item-spicy",
        name: "Spicy Chicken Burger",
        description: "Hot crispy chicken burger",
        price: "12.50",
        dietaryInfo: null,
        allergensJson: ["gluten"],
        isVegetarian: false,
        isSpicy: true,
        prepTimeMinutes: 15,
        imageUrl: null,
        isUnavailable: false,
        isActive: true,
        additions: [],
      },
      {
        id: "item-light",
        name: "Fresh Green Salad",
        description: "Fresh light salad",
        price: "7.00",
        dietaryInfo: "Vegetarian",
        allergensJson: [],
        isVegetarian: true,
        isSpicy: false,
        prepTimeMinutes: 8,
        imageUrl: null,
        isUnavailable: false,
        isActive: true,
        additions: [],
      },
    ],
  },
];

test.describe("Menu Chat Assistant", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/menu?branchId=seed-branch-1", async (route) => {
      await route.fulfill({ json: menu });
    });

    await page.route("**/api/recommendations/menu", async (route) => {
      await route.fulfill({ json: { recommendations: [] } });
    });
  });

  test("opens, sends a message, renders reply and adds suggested item to cart", async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null;

    await page.route("**/api/ai/menu-chat", async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        json: {
          reply: "Here are a few spicy options from the current menu.",
          suggestedItems: [
            {
              menuItemId: "item-spicy",
              name: "Spicy Chicken Burger",
              reason: "Marked as spicy and currently available.",
            },
          ],
          safetyNotes: [],
        },
      });
    });

    await page.goto("/customer/session/e2e-session/menu");

    await page.getByTestId("menu-chat-open").click();
    await expect(page.getByTestId("menu-chat-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: "I want something spicy" })).toBeVisible();

    await page.getByRole("button", { name: "I want something spicy" }).click();
    await expect(page.getByTestId("menu-chat-loading")).toBeVisible();
    await expect(page.getByText("Here are a few spicy options from the current menu.")).toBeVisible();
    await expect(page.getByTestId("menu-chat-suggestion")).toContainText("Spicy Chicken Burger");
    await expect(page.getByTestId("menu-chat-suggestion")).toContainText("12.50");

    expect(requestBody?.branchId).toBe("seed-branch-1");
    expect(requestBody?.sessionId).toBe("e2e-session");
    expect(requestBody?.message).toBe("I want something spicy");

    await page.getByRole("button", { name: "Add Spicy Chicken Burger to cart" }).click();
    await expect(page.getByRole("button", { name: /View Cart/ })).toBeVisible();
  });

  test("shows compact error state when the chat request fails", async ({ page }) => {
    await page.route("**/api/ai/menu-chat", async (route) => {
      await route.fulfill({
        status: 500,
        json: { message: "failed" },
      });
    });

    await page.goto("/customer/session/e2e-session/menu");

    await page.getByTestId("menu-chat-open").click();
    await page.getByPlaceholder("Ask about the menu").fill("What do you recommend?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("menu-chat-error")).toContainText(
      "Menu assistant is unavailable right now.",
    );
    await expect(page.getByText("You can keep browsing the menu.")).toBeVisible();
  });
});
