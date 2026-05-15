import "dotenv/config";
import assert from "node:assert/strict";
import { validate } from "class-validator";
import {
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  SessionStatus,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { MenuChatLlmService } from "./menu-chat-llm.service.js";
import { MenuChatRequestDto } from "./dto/menu-chat-request.dto.js";
import { MenuChatbotService } from "./menu-chatbot.service.js";
import { RecommendationService } from "./recommendation.service.js";

const prisma = new PrismaService();
const recommendationService = new RecommendationService(prisma);
const service = new MenuChatbotService(prisma, recommendationService);
const originalFetch = globalThis.fetch;
const runId = `menu-chat-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  otherTenant: `${runId}-other-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  otherTenantBranch: `${runId}-other-tenant-branch`,
  table: `${runId}-table`,
  otherTable: `${runId}-other-table`,
  otherTenantTable: `${runId}-other-tenant-table`,
  session: `${runId}-session`,
  otherSession: `${runId}-other-session`,
  otherTenantSession: `${runId}-other-tenant-session`,
  user: `${runId}-user`,
  category: `${runId}-category`,
  otherCategory: `${runId}-other-category`,
  otherTenantCategory: `${runId}-other-tenant-category`,
  vegetarianItem: `${runId}-vegetarian`,
  spicyItem: `${runId}-spicy`,
  lightItem: `${runId}-light`,
  dairySafeItem: `${runId}-dairy-safe`,
  cheapItem: `${runId}-cheap`,
  quickItem: `${runId}-quick`,
  kidsItem: `${runId}-kids`,
  dessertItem: `${runId}-dessert`,
  drinkItem: `${runId}-drink`,
  cartItem: `${runId}-cart`,
  popularItem: `${runId}-popular`,
  inactiveItem: `${runId}-inactive`,
  unavailableItem: `${runId}-unavailable`,
  otherBranchItem: `${runId}-other-branch-item`,
  otherTenantItem: `${runId}-other-tenant-item`,
};

async function cleanup() {
  const tenantIds = [ids.tenant, ids.otherTenant];
  const branchIds = [ids.branch, ids.otherBranch, ids.otherTenantBranch];

  await prisma.branchSettings.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.menuChatLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.recommendationLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.table.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.menuItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

async function seed() {
  await prisma.tenant.createMany({
    data: [
      { id: ids.tenant, name: "Menu Chat Tenant" },
      { id: ids.otherTenant, name: "Menu Chat Other Tenant" },
    ],
  });

  await prisma.branch.createMany({
    data: [
      { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
      { id: ids.otherBranch, tenantId: ids.tenant, name: "Other", location: "Test" },
      {
        id: ids.otherTenantBranch,
        tenantId: ids.otherTenant,
        name: "Other Tenant",
        location: "Test",
      },
    ],
  });

  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "MC1", capacity: 2 },
      { id: ids.otherTable, branchId: ids.otherBranch, tableCode: "MC2", capacity: 2 },
      {
        id: ids.otherTenantTable,
        branchId: ids.otherTenantBranch,
        tableCode: "MC3",
        capacity: 2,
      },
    ],
  });

  await prisma.user.create({
    data: {
      id: ids.user,
      tenantId: ids.tenant,
      name: "Menu Chat Tester",
      phone: `+1556${Date.now().toString().slice(-7)}`,
    },
  });

  await prisma.category.createMany({
    data: [
      { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Mains" },
      {
        id: ids.otherCategory,
        tenantId: ids.tenant,
        branchId: ids.otherBranch,
        name: "Other Mains",
      },
      {
        id: ids.otherTenantCategory,
        tenantId: ids.otherTenant,
        branchId: ids.otherTenantBranch,
        name: "Other Tenant Mains",
      },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      menuItem(ids.vegetarianItem, "Garden Vegetarian Bowl", {
        isVegetarian: true,
        dietaryInfo: "Vegetarian",
      }),
      menuItem(ids.spicyItem, "Spicy Chicken Burger", {
        isSpicy: true,
        description: "Hot crispy chicken burger",
      }),
      menuItem(ids.lightItem, "Fresh Green Salad", {
        description: "Fresh light salad",
      }),
      menuItem(ids.dairySafeItem, "Grilled Fish", {
        allergensJson: ["gluten"],
        description: "Grilled fish with lemon",
      }),
      menuItem(ids.cheapItem, "Bread Basket", {
        price: "2.00",
        description: "Simple bread starter",
      }),
      menuItem(ids.quickItem, "Quick Soup", {
        prepTimeMinutes: 5,
        description: "Ready fast",
      }),
      menuItem(ids.kidsItem, "Kids Mini Pasta", {
        description: "Small pasta for children",
      }),
      menuItem(ids.dessertItem, "Chocolate Cake", {
        description: "Sweet dessert",
      }),
      menuItem(ids.drinkItem, "Fresh Apple Juice", {
        description: "Cold juice drink",
      }),
      menuItem(ids.cartItem, "Classic Burger"),
      menuItem(ids.popularItem, "Popular Pasta"),
      menuItem(ids.inactiveItem, "Inactive Pasta", { isActive: false }),
      menuItem(ids.unavailableItem, "Unavailable Pasta", { isUnavailable: true }),
      menuItem(ids.otherBranchItem, "Other Branch Pasta", {}, ids.otherBranch, ids.otherCategory),
      menuItem(
        ids.otherTenantItem,
        "Other Tenant Pasta",
        {},
        ids.otherTenantBranch,
        ids.otherTenantCategory,
        ids.otherTenant,
      ),
    ],
  });

  await prisma.session.createMany({
    data: [
      session(ids.session, ids.tenant, ids.branch, ids.table, ids.user),
      session(ids.otherSession, ids.tenant, ids.otherBranch, ids.otherTable),
      session(ids.otherTenantSession, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantTable),
    ],
  });

  const now = new Date();
  await createOrder(ids.branch, ids.tenant, ids.session, [
    [ids.popularItem, 6],
    [ids.inactiveItem, 4],
    [ids.unavailableItem, 4],
  ]);
  await createOrder(ids.branch, ids.tenant, ids.session, [
    [ids.cartItem, 1],
    [ids.popularItem, 3],
  ]);
  await createOrder(ids.otherBranch, ids.tenant, ids.otherSession, [
    [ids.otherBranchItem, 9],
  ]);
  await createOrder(ids.otherTenantBranch, ids.otherTenant, ids.otherTenantSession, [
    [ids.otherTenantItem, 9],
  ]);

  await prisma.order.updateMany({
    where: { tenantId: { in: [ids.tenant, ids.otherTenant] } },
    data: { orderDateTime: now },
  });
}

function menuItem(
  id: string,
  name: string,
  overrides: {
    description?: string;
    dietaryInfo?: string;
    allergensJson?: string[];
    isVegetarian?: boolean;
    isSpicy?: boolean;
    isActive?: boolean;
    isUnavailable?: boolean;
    prepTimeMinutes?: number;
    price?: string;
  } = {},
  branchId = ids.branch,
  categoryId = ids.category,
  tenantId = ids.tenant,
) {
  return {
    id,
    tenantId,
    branchId,
    categoryId,
    name,
    description: overrides.description,
    dietaryInfo: overrides.dietaryInfo,
    allergensJson: overrides.allergensJson,
    isVegetarian: overrides.isVegetarian ?? false,
    isSpicy: overrides.isSpicy ?? false,
    prepTimeMinutes: overrides.prepTimeMinutes,
    price: overrides.price ?? "10.00",
    isActive: overrides.isActive ?? true,
    isUnavailable: overrides.isUnavailable ?? false,
    taxClass: TaxClass.FOOD,
  };
}

function session(
  id: string,
  tenantId: string,
  branchId: string,
  tableId: string,
  userId?: string,
) {
  return {
    id,
    tenantId,
    branchId,
    tableId,
    userId,
    guestCount: 1,
    status: SessionStatus.ACTIVE,
  };
}

async function createOrder(
  branchId: string,
  tenantId: string,
  sessionId: string,
  items: Array<[string, number]>,
) {
  await prisma.order.create({
    data: {
      tenantId,
      branchId,
      sessionId,
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: OrderPaymentStatus.PAID,
      source: OrderSource.USER_APP,
      subtotalAmount: "10.00",
      taxAmount: "0.00",
      serviceChargeAmount: "0.00",
      discountAmount: "0.00",
      totalAmount: "10.00",
      orderItems: {
        create: items.map(([menuItemId, quantity]) => ({
          tenantId,
          branchId,
          menuItemId,
          quantity,
          itemBasePrice: "10.00",
          lineDiscountAmount: "0.00",
          lineTaxAmount: "0.00",
          lineTotal: "10.00",
        })),
      },
    },
  });
}

function idsFrom(response: { suggestedItems: Array<{ menuItemId: string }> }) {
  return new Set(response.suggestedItems.map((item) => item.menuItemId));
}

function mockFetchFailure() {
  globalThis.fetch = (async () => {
    throw new Error("AI service unavailable in test");
  }) as typeof fetch;
}

function mockInvalidAiSuggestion() {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        reply: "Invalid AI suggestion",
        suggestedItems: [
          {
            menuItemId: ids.otherTenantItem,
            name: "Other Tenant Pasta",
            reason: "Invalid cross-tenant suggestion",
          },
        ],
        safetyNotes: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;
}

async function assertDtoValidation() {
  const empty = new MenuChatRequestDto();
  empty.branchId = ids.branch;
  empty.message = "";
  assert.ok((await validate(empty)).length > 0, "empty message should be rejected");

  const tooLong = new MenuChatRequestDto();
  tooLong.branchId = ids.branch;
  tooLong.message = "x".repeat(501);
  assert.ok((await validate(tooLong)).length > 0, "long message should be rejected");

  const badQuantity = new MenuChatRequestDto();
  badQuantity.branchId = ids.branch;
  badQuantity.message = "Recommend something";
  badQuantity.cartItems = [{ menuItemId: ids.cartItem, quantity: 0 }];
  assert.ok((await validate(badQuantity)).length > 0, "invalid cart quantity should be rejected");
}

async function main() {
  await cleanup();
  await seed();
  mockFetchFailure();

  await assertDtoValidation();

  const general = await service.chat({
    branchId: ids.branch,
    sessionId: ids.session,
    message: "What do you recommend?",
    cartItems: [{ menuItemId: ids.cartItem, quantity: 1 }],
  });
  const generalIds = idsFrom(general);
  assert.equal(generalIds.has(ids.popularItem), true, "fallback should recommend popular item");
  assert.equal(generalIds.has(ids.cartItem), false, "cart item must be excluded");
  assert.equal(generalIds.has(ids.inactiveItem), false, "inactive item must be excluded");
  assert.equal(generalIds.has(ids.unavailableItem), false, "unavailable item must be excluded");
  assert.equal(generalIds.has(ids.otherBranchItem), false, "other branch item must not leak");
  assert.equal(generalIds.has(ids.otherTenantItem), false, "other tenant item must not leak");

  const vegetarian = await service.chat({
    branchId: ids.branch,
    message: "What is vegetarian?",
  });
  assert.equal(idsFrom(vegetarian).has(ids.vegetarianItem), true, "vegetarian query should use vegetarian fields");

  const spicy = await service.chat({
    branchId: ids.branch,
    message: "I want something spicy",
  });
  assert.equal(idsFrom(spicy).has(ids.spicyItem), true, "spicy query should use spicy fields");

  const arabicSpicy = await service.chat({
    branchId: ids.branch,
    message: "بدي اشي حار",
  });
  assert.equal(arabicSpicy.language, "ar", "Arabic messages should return language metadata");
  assert.equal(idsFrom(arabicSpicy).has(ids.spicyItem), true, "Arabic spicy query should use spicy fields");
  assert.ok(/حار/.test(arabicSpicy.reply), "Arabic spicy query should use Arabic deterministic copy");

  const mild = await service.chat({
    branchId: ids.branch,
    message: "I want something not spicy",
  });
  assert.equal(idsFrom(mild).has(ids.spicyItem), false, "mild query should exclude spicy items");
  assert.ok(mild.suggestedItems.length > 0, "mild query should return non-spicy items");

  const budget = await service.chat({
    branchId: ids.branch,
    sessionId: ids.session,
    message: "What is cheapest?",
  });
  assert.equal(budget.suggestedItems[0]?.menuItemId, ids.cheapItem, "budget query should sort by price");

  const budgetFollowUp = await service.chat({
    branchId: ids.branch,
    sessionId: ids.session,
    message: "Anything else?",
  });
  assert.equal(
    idsFrom(budgetFollowUp).has(ids.cheapItem),
    false,
    "session memory follow-up should avoid repeating the last budget suggestions",
  );
  assert.ok(
    budgetFollowUp.reply.toLowerCase().includes("lower-priced") ||
      budgetFollowUp.reply.toLowerCase().includes("popular"),
    "session memory follow-up should preserve the previous recommendation intent",
  );

  const quick = await service.chat({
    branchId: ids.branch,
    message: "What is ready fast?",
  });
  assert.equal(idsFrom(quick).has(ids.quickItem), true, "fast prep query should use prep time");

  const kids = await service.chat({
    branchId: ids.branch,
    message: "What is good for kids?",
  });
  assert.equal(idsFrom(kids).has(ids.kidsItem), true, "kids query should use kid-friendly menu text");

  const protein = await service.chat({
    branchId: ids.branch,
    message: "I want high protein",
  });
  assert.equal(idsFrom(protein).has(ids.dairySafeItem), true, "protein query should match fish/meat terms");

  const dessert = await service.chat({
    branchId: ids.branch,
    message: "Any dessert?",
  });
  assert.equal(idsFrom(dessert).has(ids.dessertItem), true, "dessert query should match dessert terms");

  const drink = await service.chat({
    branchId: ids.branch,
    message: "I want a drink",
  });
  assert.equal(idsFrom(drink).has(ids.drinkItem), true, "drink query should match beverage terms");

  const noMushrooms = await service.chat({
    branchId: ids.branch,
    message: "No mushrooms please",
  });
  assert.equal(noMushrooms.requiresStaffHelp, true, "ingredient exclusions should advise staff confirmation");
  assert.equal(noMushrooms.staffHelpReason, "INGREDIENT_UNCERTAIN");

  const dairy = await service.chat({
    branchId: ids.branch,
    message: "Do you have anything without dairy?",
  });
  assert.equal(idsFrom(dairy).has(ids.dairySafeItem), true, "dairy query should use explicit allergen data");
  assert.ok(dairy.safetyNotes?.length, "dairy query should include safety note");
  assert.equal(dairy.requiresStaffHelp, true, "allergen-style query should offer staff help");

  const allergenUnknown = await service.chat({
    branchId: ids.branch,
    message: "Do you have anything without shellfish?",
    cartItems: [{ menuItemId: ids.dairySafeItem, quantity: 1 }],
  });
  assert.equal(allergenUnknown.suggestedItems.length, 0, "missing allergen certainty should not use fallback");
  assert.ok(allergenUnknown.safetyNotes?.length, "unknown allergen data should include safety note");
  assert.equal(allergenUnknown.requiresStaffHelp, true, "unknown allergen query should escalate to staff");
  assert.equal(allergenUnknown.staffHelpReason, "ALLERGEN_UNCERTAIN");

  const paymentQuestion = await service.chat({
    branchId: ids.branch,
    message: "Can I pay by card or use a coupon?",
  });
  assert.equal(paymentQuestion.requiresStaffHelp, true, "payment/policy questions should escalate to staff");
  assert.equal(paymentQuestion.staffHelpReason, "POLICY_OR_PAYMENT");
  assert.equal(paymentQuestion.suggestedItems.length, 0, "payment/policy questions should not invent menu suggestions");

  const arabicPaymentQuestion = await service.chat({
    branchId: ids.branch,
    message: "هل يمكن الدفع بالبطاقة؟",
  });
  assert.equal(arabicPaymentQuestion.language, "ar", "Arabic escalation should return language metadata");
  assert.equal(arabicPaymentQuestion.requiresStaffHelp, true, "Arabic payment questions should escalate to staff");
  assert.equal(arabicPaymentQuestion.staffHelpReason, "POLICY_OR_PAYMENT");
  assert.ok(/الموظفين/.test(arabicPaymentQuestion.reply), "Arabic payment escalation should use Arabic copy");

  const customPrepQuestion = await service.chat({
    branchId: ids.branch,
    message: "Can you make it with extra sauce on the side?",
  });
  assert.equal(customPrepQuestion.requiresStaffHelp, true, "custom prep questions should escalate to staff");
  assert.equal(customPrepQuestion.staffHelpReason, "CUSTOM_PREPARATION");
  assert.equal(customPrepQuestion.suggestedItems.length, 0, "custom prep questions should not invent capability");

  const pairing = await service.chat({
    branchId: ids.branch,
    message: "What goes well with burger?",
  });
  assert.equal(idsFrom(pairing).has(ids.popularItem), true, "pairing should use recommendation fallback");

  mockInvalidAiSuggestion();
  const invalidAi = await service.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.equal(idsFrom(invalidAi).has(ids.otherTenantItem), false, "invalid AI item IDs must be filtered");
  assert.equal(idsFrom(invalidAi).has(ids.popularItem), true, "invalid AI response should keep local fallback");

  const unknown = await service.chat({
    branchId: ids.branch,
    message: "Do you have pizza?",
  });
  assert.ok(unknown.reply.length > 0, "unknown menu questions should return a grounded reply");
  assert.ok(unknown.suggestedItems.length > 0, "unknown menu questions should not leave the chat empty");
  assert.equal(idsFrom(unknown).has(ids.otherBranchItem), false, "unknown fallback must not leak other branches");
  assert.equal(idsFrom(unknown).has(ids.otherTenantItem), false, "unknown fallback must not leak other tenants");

  const llmService = new MenuChatbotService(
    prisma,
    recommendationService,
    {
      chat: async () => ({
        reply: "LLM answer from scoped branch menu.",
        suggestedItems: [
          { menuItemId: ids.popularItem, reason: "Listed on this branch menu." },
          { menuItemId: ids.otherTenantItem, reason: "Invalid cross-tenant item." },
        ],
        safetyNotes: [],
      }),
    } as unknown as MenuChatLlmService,
  );
  const llmResponse = await llmService.chat({
    branchId: ids.branch,
    message: "What pasta can I get?",
  });
  assert.equal(llmResponse.reply, "LLM answer from scoped branch menu.");
  assert.equal(idsFrom(llmResponse).has(ids.popularItem), true, "LLM can suggest scoped menu items");
  assert.equal(idsFrom(llmResponse).has(ids.otherTenantItem), false, "LLM suggestions must be filtered by scope");

  const unsupportedClaimService = new MenuChatbotService(
    prisma,
    recommendationService,
    {
      chat: async () => ({
        reply: "This item has a discount and is gluten-free.",
        suggestedItems: [{ menuItemId: ids.popularItem, reason: "Discounted today." }],
        safetyNotes: [],
      }),
    } as unknown as MenuChatLlmService,
  );
  const unsupportedClaimResponse = await unsupportedClaimService.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.notEqual(
    unsupportedClaimResponse.reply,
    "This item has a discount and is gluten-free.",
    "unsupported LLM claims should be rejected",
  );

  const tooManyNotesService = new MenuChatbotService(
    prisma,
    recommendationService,
    {
      chat: async () => ({
        reply: "LLM answer from scoped branch menu.",
        suggestedItems: [{ menuItemId: ids.popularItem, reason: "Listed here." }],
        safetyNotes: ["one", "two", "three", "four"],
      }),
    } as unknown as MenuChatLlmService,
  );
  const tooManyNotesResponse = await tooManyNotesService.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.notEqual(
    tooManyNotesResponse.reply,
    "LLM answer from scoped branch menu.",
    "LLM responses with too many safety notes should be rejected",
  );

  await prisma.branchSettings.upsert({
    where: { branchId: ids.branch },
    update: { tenantId: ids.tenant, aiConfigJson: { fallbackOnly: true } },
    create: { branchId: ids.branch, tenantId: ids.tenant, aiConfigJson: { fallbackOnly: true } },
  });
  const fallbackOnlyService = new MenuChatbotService(
    prisma,
    recommendationService,
    {
      chat: async () => ({
        reply: "LLM should be blocked by fallback-only mode.",
        suggestedItems: [{ menuItemId: ids.popularItem, reason: "Provider suggestion." }],
        safetyNotes: [],
      }),
    } as unknown as MenuChatLlmService,
  );
  const fallbackOnlyResponse = await fallbackOnlyService.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.notEqual(
    fallbackOnlyResponse.reply,
    "LLM should be blocked by fallback-only mode.",
    "fallback-only branch AI config should skip hosted providers",
  );

  await prisma.branchSettings.update({
    where: { branchId: ids.branch },
    data: { aiConfigJson: { menuChatEnabled: false } },
  });
  const disabledResponse = await service.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.equal(disabledResponse.suggestedItems.length, 0, "disabled menu assistant should not suggest items");
  assert.ok(disabledResponse.reply.toLowerCase().includes("disabled"), "disabled menu assistant should explain disabled state");

  await prisma.branchSettings.update({
    where: { branchId: ids.branch },
    data: { aiConfigJson: { dailyRequestLimit: 1 } },
  });
  const dailyLimitedResponse = await service.chat({
    branchId: ids.branch,
    message: "Suggest something",
  });
  assert.equal(dailyLimitedResponse.suggestedItems.length, 0, "daily request limit should block suggestions");
  assert.ok(
    dailyLimitedResponse.reply.toLowerCase().includes("limit"),
    "daily request limit should explain rate limiting",
  );

  await prisma.branchSettings.update({
    where: { branchId: ids.branch },
    data: { aiConfigJson: { dailyRequestLimit: 1000, sessionHourlyRequestLimit: 1 } },
  });
  const sessionLimitedResponse = await service.chat({
    branchId: ids.branch,
    sessionId: ids.session,
    message: "Suggest something",
  });
  assert.equal(sessionLimitedResponse.suggestedItems.length, 0, "session hourly limit should block suggestions");
  assert.ok(
    sessionLimitedResponse.reply.toLowerCase().includes("limit"),
    "session hourly limit should explain rate limiting",
  );

  await prisma.branchSettings.update({
    where: { branchId: ids.branch },
    data: {
      aiConfigJson: {
        dailyRequestLimit: 1000,
        sessionHourlyRequestLimit: 100,
        maxSuggestions: 2,
        assistantTone: "friendly",
      },
    },
  });
  const shapedResponse = await service.chat({
    branchId: ids.branch,
    message: "What do you recommend?",
  });
  assert.ok(shapedResponse.suggestedItems.length <= 2, "maxSuggestions should shape final responses");
  assert.ok(shapedResponse.reply.startsWith("Sure."), "assistantTone should shape deterministic replies");

  await prisma.branchSettings.delete({ where: { branchId: ids.branch } });

  await assert.rejects(
    () =>
      service.chat({
        tenantId: ids.otherTenant,
        branchId: ids.branch,
        message: "Recommend something",
      }),
    /Branch does not belong to tenant/,
  );

  await assert.rejects(
    () =>
      service.chat({
        branchId: ids.branch,
        sessionId: ids.otherSession,
        message: "Recommend something",
      }),
    /Session does not belong to branch/,
  );

  const log = await prisma.menuChatLog.findFirst({
    where: { tenantId: ids.tenant, branchId: ids.branch, messageIntent: "GENERAL_RECOMMENDATION" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log, "chat request should create MenuChatLog");
  assert.equal(log.messagePreview?.startsWith("Suggest something") || log.messagePreview?.startsWith("What do you recommend?"), true);
  assert.ok(Array.isArray(log.suggestedItemIds), "log should store suggested item IDs");

  const memoryLogs = await prisma.menuChatLog.findMany({
    where: { tenantId: ids.tenant, branchId: ids.branch, sessionId: ids.session },
    orderBy: { createdAt: "desc" },
  });
  const memoryLog = memoryLogs.find((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return metadata?.memoryApplied === true;
  });
  const memoryMetadata = memoryLog?.metadata as Record<string, unknown> | null;
  assert.ok(memoryMetadata?.conversationMemory, "session chat logs should persist compact conversation memory");
  assert.equal(
    memoryMetadata?.memoryApplied,
    true,
    "follow-up requests should record that conversation memory was applied",
  );

  const escalationLog = await prisma.menuChatLog.findFirst({
    where: { tenantId: ids.tenant, branchId: ids.branch, messageIntent: "CUSTOM_PREPARATION" },
    orderBy: { createdAt: "desc" },
  });
  const escalationMetadata = escalationLog?.metadata as Record<string, unknown> | null;
  assert.equal(escalationMetadata?.requiresStaffHelp, true, "staff escalation should be logged as metadata");
  assert.equal(escalationMetadata?.staffHelpReason, "CUSTOM_PREPARATION");

  const diagnostics = await service.getDiagnostics({
    tenantId: ids.tenant,
    branchId: ids.branch,
    hours: 24,
  });
  assert.ok(diagnostics.totals.requests > 0, "diagnostics should count menu chat requests");
  assert.ok("rules" in diagnostics.byProvider, "diagnostics should include rules provider usage");
  assert.equal(
    Object.prototype.hasOwnProperty.call(diagnostics, "messagePreview"),
    false,
    "diagnostics must not expose raw message previews",
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(diagnostics, "messageHash"),
    false,
    "diagnostics must not expose message hashes",
  );

  await assert.rejects(
    () =>
      service.getDiagnostics({
        tenantId: ids.otherTenant,
        branchId: ids.branch,
        hours: 24,
      }),
    /Branch does not belong to tenant/,
  );

  const rejectedProviderLog = await prisma.menuChatLog.findFirst({
    where: { tenantId: ids.tenant, branchId: ids.branch },
    orderBy: { createdAt: "desc" },
  });
  const rejectedProviderMetadata = rejectedProviderLog?.metadata as Record<string, unknown> | null;
  assert.ok(
    !rejectedProviderMetadata ||
      rejectedProviderMetadata.providerRejectionReason === undefined ||
      typeof rejectedProviderMetadata.providerRejectionReason === "string",
    "provider rejection diagnostics should be logged as metadata when present",
  );

  const originalCreate = prisma.menuChatLog.create.bind(prisma.menuChatLog);
  prisma.menuChatLog.create = (async () => {
    throw new Error("forced logging failure");
  }) as unknown as typeof prisma.menuChatLog.create;
  const responseWithLoggingFailure = await service.chat({
    branchId: ids.branch,
    message: "I want something spicy",
  });
  assert.equal(
    idsFrom(responseWithLoggingFailure).has(ids.spicyItem),
    true,
    "logging failure must not break response",
  );
  prisma.menuChatLog.create = originalCreate;

  console.log("Menu Chatbot Phase 9 checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    globalThis.fetch = originalFetch;
    await cleanup();
    await prisma.$disconnect();
  });
