import { BadRequestException, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  MenuChatRequest,
  MenuChatResponse,
  MenuChatLanguage,
  MenuChatStaffHelpReason,
  MenuChatSuggestedItem,
} from "@smart-restaurant/shared-types";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { MenuChatLlmService, type MenuChatLlmResponse } from "./menu-chat-llm.service.js";
import { RecommendationService } from "./recommendation.service.js";

type MenuChatIntent =
  | "GENERAL_RECOMMENDATION"
  | "SPICY"
  | "NOT_SPICY"
  | "VEGETARIAN"
  | "LIGHT"
  | "PAIRING"
  | "BUDGET_FRIENDLY"
  | "KIDS_MEAL"
  | "HIGH_PROTEIN"
  | "FAST_PREP"
  | "INGREDIENT_EXCLUSION"
  | "DESSERT"
  | "DRINK"
  | "DAIRY_FREE"
  | "ALLERGEN"
  | "POLICY_OR_PAYMENT"
  | "CUSTOM_PREPARATION"
  | "UNKNOWN";

interface ScopedBranch {
  id: string;
  tenantId: string;
  name: string;
}

interface ScopedSession {
  userId: string | null;
}

interface MenuContextItem {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  dietaryInfo: string | null;
  allergensJson: Prisma.JsonValue | null;
  isVegetarian: boolean;
  isSpicy: boolean;
  prepTimeMinutes: number | null;
  price: Prisma.Decimal;
  category: { name: string };
}

interface AiMenuChatResponse {
  reply?: unknown;
  suggestedItems?: unknown;
  safetyNotes?: unknown;
}

interface ProviderValidationResult {
  response: MenuChatResponse | null;
  rejectionReason?: string;
}

interface MenuChatConversationMemory {
  lastIntent?: MenuChatIntent;
  dietaryConstraints: string[];
  avoidedIngredients: string[];
  preferredAttributes: string[];
  lastSuggestedItemIds: string[];
  turns: number;
  updatedAt: string;
}

interface MenuChatControls {
  enabled: boolean;
  hostedLlmEnabled: boolean;
  fallbackOnly: boolean;
  dailyHostedRequestLimit: number;
  dailyRequestLimit: number;
  sessionHourlyRequestLimit: number;
  hostedProviderTimeoutMs: number;
  maxResponseLength: number;
  maxSuggestions: number;
  assistantTone: "concise" | "friendly" | "formal";
}

const ALLERGEN_SAFETY_NOTE =
  "I can't confirm that from the available menu data. Please ask the restaurant staff to be safe.";

const AR_ALLERGEN_SAFETY_NOTE =
  "لا أستطيع تأكيد ذلك من بيانات القائمة المتاحة. يرجى سؤال موظفي المطعم للتأكد.";

const INTENT_PATTERNS: Record<MenuChatIntent, RegExp> = {
  GENERAL_RECOMMENDATION:
    /\b(recommend|suggest|popular|best|favorite|favourite|what should i get|what do you recommend)\b/i,
  SPICY: /\b(spicy|hot|chilli|chili|spice|fiery)\b/i,
  NOT_SPICY: /\b(not spicy|non.?spicy|mild|no spice|without spice|not hot)\b/i,
  VEGETARIAN: /\b(vegetarian|veggie|vegan|plant.?based|meatless)\b/i,
  LIGHT: /\b(light|fresh|healthy|small|not heavy|low.?fat|salad)\b/i,
  PAIRING: /\b(pair|goes?.with|with my cart|with the cart|what.+with|complement|side)\b/i,
  BUDGET_FRIENDLY: /\b(cheap|cheaper|cheapest|budget|affordable|low.?cost|inexpensive|least expensive)\b/i,
  KIDS_MEAL: /\b(kid|kids|child|children|family.?friendly)\b/i,
  HIGH_PROTEIN: /\b(high.?protein|protein|chicken|beef|fish|meat)\b/i,
  FAST_PREP: /\b(fast|quick|quickest|soon|short prep|preparation time|prep time|ready fast)\b/i,
  INGREDIENT_EXCLUSION: /\b(without|no|exclude|avoid|hold)\s+([a-zA-Z][a-zA-Z\s-]{1,40})\b/i,
  DESSERT: /\b(dessert|sweet|cake|ice cream|brownie|pudding)\b/i,
  DRINK: /\b(drink|beverage|juice|soda|cola|coffee|tea|water)\b/i,
  DAIRY_FREE: /\b(dairy.?free|without dairy|no dairy|lactose|milk|cheese|butter|cream)\b/i,
  ALLERGEN: /\b(allerg|gluten|nut|peanut|egg|soy|sesame|shellfish|celiac)\b/i,
  POLICY_OR_PAYMENT: /\b(pay|payment|cash|card|refund|discount|coupon|promo|promotion|policy|reservation|hours|wifi|parking|service charge|tip)\b/i,
  CUSTOM_PREPARATION: /\b(can you make|custom|substitute|swap|replace|cook it|well done|medium rare|less salt|extra sauce|on the side)\b/i,
  UNKNOWN: /$a/,
};

@Injectable()
export class MenuChatbotService {
  private readonly logger = new Logger(MenuChatbotService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RecommendationService)
    private readonly recommendationService: RecommendationService,
    @Optional()
    @Inject(MenuChatLlmService)
    private readonly menuChatLlmService?: MenuChatLlmService,
  ) {}

  async getDiagnostics(input: {
    tenantId: string;
    branchId: string;
    hours?: number;
  }) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!branch) {
      throw new BadRequestException("Branch does not belong to tenant");
    }

    const hours = Math.min(Math.max(input.hours ?? 24, 1), 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const controls = await this.loadControls(branch);
    const logs = await this.prisma.menuChatLog.findMany({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        createdAt: { gte: since },
      },
      select: {
        messageIntent: true,
        usedAiService: true,
        usedFallback: true,
        safetyNotes: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const byProvider: Record<string, number> = {};
    const byIntent: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const rejectionReasons: Record<string, number> = {};
    const controlModes: Record<string, number> = {};
    let staffHelpCount = 0;
    let fallbackCount = 0;
    let hostedCount = 0;

    for (const log of logs) {
      if (log.messageIntent) byIntent[log.messageIntent] = (byIntent[log.messageIntent] ?? 0) + 1;
      if (log.usedFallback) fallbackCount += 1;
      if (log.usedAiService) hostedCount += 1;

      const metadata = this.objectMetadata(log.metadata);
      const provider = typeof metadata.aiProvider === "string" ? metadata.aiProvider : log.usedAiService ? "hosted" : "rules";
      byProvider[provider] = (byProvider[provider] ?? 0) + 1;

      const language = typeof metadata.language === "string" ? metadata.language : "unknown";
      byLanguage[language] = (byLanguage[language] ?? 0) + 1;

      const rejection = metadata.providerRejectionReason;
      if (typeof rejection === "string") {
        rejectionReasons[rejection] = (rejectionReasons[rejection] ?? 0) + 1;
      }

      const controlMode = metadata.controlMode;
      if (typeof controlMode === "string") {
        controlModes[controlMode] = (controlModes[controlMode] ?? 0) + 1;
      }

      if (metadata.requiresStaffHelp === true || this.jsonArrayLength(log.safetyNotes) > 0) {
        staffHelpCount += 1;
      }
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      windowHours: hours,
      generatedAt: new Date().toISOString(),
      controls,
      totals: {
        requests: logs.length,
        hostedRequests: hostedCount,
        fallbackResponses: fallbackCount,
        staffHelpResponses: staffHelpCount,
        providerRejections: Object.values(rejectionReasons).reduce((sum, count) => sum + count, 0),
      },
      byProvider,
      byIntent,
      byLanguage,
      rejectionReasons,
      controlModes,
      latestAt: logs[0]?.createdAt?.toISOString() ?? null,
    };
  }

  async chat(input: MenuChatRequest): Promise<MenuChatResponse> {
    const message = input.message.trim();
    const language = this.detectLanguage(message);
    const detectedIntent = this.detectIntent(message);
    const branch = await this.loadScopedBranch(input);
    if (!branch) {
      return {
        reply: this.t(language, "branchNotFound"),
        suggestedItems: [],
        safetyNotes: [],
        language,
      };
    }
    const controls = await this.loadControls(branch);

    const session = await this.validateSession(input, branch);
    const effectiveUserId = session?.userId ?? undefined;
    const requestLimitReason = await this.requestLimitReason(branch, input, controls);
    if (requestLimitReason) {
      const limitedResult: MenuChatResponse = {
        reply: language === "ar"
          ? "تم الوصول إلى حد استخدام مساعد القائمة مؤقتا. يمكنك متابعة تصفح القائمة أو طلب المساعدة من الموظفين."
          : "The menu assistant limit has been reached for now. You can keep browsing the menu or ask staff for help.",
        suggestedItems: [],
        safetyNotes: [],
        language,
      };
      await this.logChat({
        branch,
        input,
        effectiveUserId,
        detectedIntent,
        resolvedIntent: detectedIntent,
        suggestedItems: [],
        safetyNotes: [],
        language,
        usedAiService: false,
        usedFallback: false,
        conversationMemory: this.nextConversationMemory({
          priorMemory: null,
          detectedIntent,
          resolvedIntent: detectedIntent,
          message,
          suggestedItems: [],
        }),
        memoryApplied: false,
        controlMode: requestLimitReason,
      });
      return limitedResult;
    }
    if (!controls.enabled) {
      const disabledResult: MenuChatResponse = {
        reply: language === "ar"
          ? "مساعد القائمة غير مفعل حاليا لهذا الفرع."
          : "The menu assistant is currently disabled for this branch.",
        suggestedItems: [],
        safetyNotes: [],
        language,
      };
      await this.logChat({
        branch,
        input,
        effectiveUserId,
        detectedIntent,
        resolvedIntent: detectedIntent,
        suggestedItems: [],
        safetyNotes: [],
        language,
        usedAiService: false,
        usedFallback: false,
        conversationMemory: this.nextConversationMemory({
          priorMemory: null,
          detectedIntent,
          resolvedIntent: detectedIntent,
          message,
          suggestedItems: [],
        }),
        memoryApplied: false,
        controlMode: "disabled",
      });
      return disabledResult;
    }
    const priorMemory = await this.loadConversationMemory(input, branch);
    const followUp = this.isFollowUpMessage(message);
    const intent = this.resolveIntent(detectedIntent, message, priorMemory);
    const cartItems = input.cartItems ?? [];
    const cartItemIds = new Set(cartItems.map((item) => item.menuItemId));
    const menuItems = await this.loadActiveMenuItems(branch);
    const turnMenuItems = this.menuItemsForTurn(menuItems, priorMemory, followUp);
    const recommendationCartItems = this.recommendationCartItems({
      intent,
      message,
      menuItems: turnMenuItems,
      cartItems,
    });

    let usedFallback = false;
    let safetyNotes: string[] = [];
    let result = this.localResponse({
      intent,
      message,
      menuItems: turnMenuItems,
      cartItemIds,
      language,
    });

    if ((result.safetyNotes ?? []).length > 0) {
      safetyNotes = result.safetyNotes ?? [];
    }

    if (this.shouldUseRecommendationFallback(intent, result)) {
      const fallback = await this.recommendationFallback({
        input,
        branch,
        userId: effectiveUserId,
        cartItems: recommendationCartItems,
        menuItems: turnMenuItems,
      });
      if (fallback.length > 0) {
        usedFallback = true;
        result = {
          reply: this.fallbackReply(intent, language),
          suggestedItems: fallback,
          safetyNotes,
          language,
        };
      } else {
        const currentMenuFallback = this.currentMenuFallback({
          intent,
          menuItems: turnMenuItems,
          cartItemIds,
          language,
        });
        if (currentMenuFallback.suggestedItems.length > 0) {
          usedFallback = true;
          result = currentMenuFallback;
        }
      }
    }

    let aiProvider: string | undefined;
    let providerRejectionReason: string | undefined;
    const hostedLimitReached = await this.hostedLimitReached(branch, controls);
    const providerAllowed = controls.hostedLlmEnabled && !controls.fallbackOnly && !hostedLimitReached;
    const controlMode = controls.fallbackOnly
      ? "fallback_only"
      : hostedLimitReached
        ? "hosted_limit_reached"
        : controls.hostedLlmEnabled
          ? "hosted_allowed"
          : "hosted_disabled";
    const llmResult = providerAllowed && this.shouldUseLlmBoundary(result, turnMenuItems)
      ? await this.tryLlmMenuChat({
        branch,
        message,
        menuItems: turnMenuItems,
        cartItemIds,
        language,
        timeoutMs: controls.hostedProviderTimeoutMs,
        tone: controls.assistantTone,
      })
      : null;

    if (llmResult?.rejectionReason) {
      providerRejectionReason = llmResult.rejectionReason;
    }
    if (llmResult?.response) {
      result = llmResult.response;
      aiProvider = "huggingface";
    }

    const aiResult = providerAllowed && !llmResult?.response && this.shouldUseAiBoundary(intent, result)
      ? await this.tryAiMenuChat({
          message,
          menuItems: turnMenuItems,
          cartItemIds,
          language,
          timeoutMs: controls.hostedProviderTimeoutMs,
          tone: controls.assistantTone,
          allowedSuggestionIds: new Set(
            result.suggestedItems.map((item) => item.menuItemId),
          ),
        })
      : null;
    if (aiResult?.rejectionReason) {
      providerRejectionReason = aiResult.rejectionReason;
    }
    if (aiResult?.response) {
      result = aiResult.response;
      aiProvider = "fastapi";
    }

    result = this.shapeResponse(result, controls);

    const conversationMemory = this.nextConversationMemory({
      priorMemory,
      detectedIntent,
      resolvedIntent: intent,
      message,
      suggestedItems: result.suggestedItems,
    });

    await this.logChat({
      branch,
      input,
      effectiveUserId,
      detectedIntent,
      resolvedIntent: intent,
      suggestedItems: result.suggestedItems,
      safetyNotes: result.safetyNotes,
      requiresStaffHelp: result.requiresStaffHelp,
      staffHelpReason: result.staffHelpReason,
      language,
      usedAiService: Boolean(llmResult?.response || aiResult?.response),
      aiProvider,
      providerRejectionReason,
      usedFallback,
      conversationMemory,
      memoryApplied: Boolean(priorMemory && (followUp || detectedIntent === "UNKNOWN")),
      controlMode,
      responseShaping: {
        assistantTone: controls.assistantTone,
        maxSuggestions: controls.maxSuggestions,
        maxResponseLength: controls.maxResponseLength,
      },
    });

    return result;
  }

  private async loadScopedBranch(
    input: MenuChatRequest,
  ): Promise<ScopedBranch | null> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!branch) return null;

    if (input.tenantId && input.tenantId !== branch.tenantId) {
      throw new BadRequestException("Branch does not belong to tenant");
    }

    return branch;
  }

  private async validateSession(
    input: MenuChatRequest,
    branch: ScopedBranch,
  ): Promise<ScopedSession | null> {
    if (!input.sessionId) return null;

    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        tenantId: branch.tenantId,
        branchId: branch.id,
      },
      select: { userId: true },
    });
    if (!session) {
      throw new BadRequestException("Session does not belong to branch");
    }

    return session;
  }

  private async loadActiveMenuItems(
    branch: ScopedBranch,
  ): Promise<MenuContextItem[]> {
    return this.prisma.menuItem.findMany({
      where: {
        tenantId: branch.tenantId,
        isActive: true,
        isUnavailable: false,
        OR: [{ branchId: branch.id }, { branchId: null }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        ingredients: true,
        dietaryInfo: true,
        allergensJson: true,
        isVegetarian: true,
        isSpicy: true,
        prepTimeMinutes: true,
        price: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  private async loadControls(branch: ScopedBranch): Promise<MenuChatControls> {
    const settings = await this.prisma.branchSettings.findFirst({
      where: { tenantId: branch.tenantId, branchId: branch.id },
      select: { aiConfigJson: true },
    });

    return this.normalizeControls(settings?.aiConfigJson);
  }

  private normalizeControls(raw: Prisma.JsonValue | null | undefined): MenuChatControls {
    const config =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    const dailyHostedRequestLimit =
      typeof config.dailyHostedRequestLimit === "number" && Number.isFinite(config.dailyHostedRequestLimit)
        ? Math.min(Math.max(Math.floor(config.dailyHostedRequestLimit), 0), 1000)
        : 200;
    const dailyRequestLimit =
      typeof config.dailyRequestLimit === "number" && Number.isFinite(config.dailyRequestLimit)
        ? Math.min(Math.max(Math.floor(config.dailyRequestLimit), 0), 5000)
        : 1000;
    const sessionHourlyRequestLimit =
      typeof config.sessionHourlyRequestLimit === "number" && Number.isFinite(config.sessionHourlyRequestLimit)
        ? Math.min(Math.max(Math.floor(config.sessionHourlyRequestLimit), 0), 200)
        : 40;
    const hostedProviderTimeoutMs =
      typeof config.hostedProviderTimeoutMs === "number" && Number.isFinite(config.hostedProviderTimeoutMs)
        ? Math.min(Math.max(Math.floor(config.hostedProviderTimeoutMs), 750), 10_000)
        : 4500;
    const maxResponseLength =
      typeof config.maxResponseLength === "number" && Number.isFinite(config.maxResponseLength)
        ? Math.min(Math.max(Math.floor(config.maxResponseLength), 120), 700)
        : 500;
    const maxSuggestions =
      typeof config.maxSuggestions === "number" && Number.isFinite(config.maxSuggestions)
        ? Math.min(Math.max(Math.floor(config.maxSuggestions), 1), 5)
        : 5;
    const assistantTone =
      config.assistantTone === "friendly" || config.assistantTone === "formal"
        ? config.assistantTone
        : "concise";

    return {
      enabled: config.menuChatEnabled !== false,
      hostedLlmEnabled: config.hostedLlmEnabled !== false,
      fallbackOnly: config.fallbackOnly === true,
      dailyHostedRequestLimit,
      dailyRequestLimit,
      sessionHourlyRequestLimit,
      hostedProviderTimeoutMs,
      maxResponseLength,
      maxSuggestions,
      assistantTone,
    };
  }

  private shapeResponse(response: MenuChatResponse, controls: MenuChatControls): MenuChatResponse {
    return {
      ...response,
      reply: this.applyTone(response.reply, response.language ?? "en", controls.assistantTone)
        .slice(0, controls.maxResponseLength),
      suggestedItems: response.suggestedItems.slice(0, controls.maxSuggestions),
    };
  }

  private applyTone(
    reply: string,
    language: MenuChatLanguage,
    tone: MenuChatControls["assistantTone"],
  ) {
    if (tone === "concise") return reply;

    if (language === "ar") {
      if (tone === "formal") return `بكل سرور. ${reply}`;
      return `أكيد. ${reply}`;
    }

    if (tone === "formal") return `Certainly. ${reply}`;
    return `Sure. ${reply}`;
  }

  private async requestLimitReason(
    branch: ScopedBranch,
    input: MenuChatRequest,
    controls: MenuChatControls,
  ) {
    if (controls.dailyRequestLimit <= 0) return "daily_request_limit_reached";

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const branchRequestsToday = await this.prisma.menuChatLog.count({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        createdAt: { gte: dayStart },
      },
    });
    if (branchRequestsToday >= controls.dailyRequestLimit) {
      return "daily_request_limit_reached";
    }

    if (!input.sessionId) return null;
    if (controls.sessionHourlyRequestLimit <= 0) return "session_hourly_limit_reached";

    const hourStart = new Date(Date.now() - 60 * 60 * 1000);
    const sessionRequests = await this.prisma.menuChatLog.count({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        sessionId: input.sessionId,
        createdAt: { gte: hourStart },
      },
    });

    return sessionRequests >= controls.sessionHourlyRequestLimit
      ? "session_hourly_limit_reached"
      : null;
  }

  private objectMetadata(raw: Prisma.JsonValue | null): Record<string, unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw as Record<string, unknown>;
  }

  private jsonArrayLength(raw: Prisma.JsonValue | null) {
    return Array.isArray(raw) ? raw.length : 0;
  }

  private async hostedLimitReached(branch: ScopedBranch, controls: MenuChatControls) {
    if (controls.dailyHostedRequestLimit <= 0) return true;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.menuChatLog.count({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        usedAiService: true,
        createdAt: { gte: since },
      },
    });

    return used >= controls.dailyHostedRequestLimit;
  }

  private detectLanguage(message: string): MenuChatLanguage {
    return /[\u0600-\u06FF]/.test(message) ? "ar" : "en";
  }

  private t(language: MenuChatLanguage, key: string) {
    const copy: Record<string, Record<MenuChatLanguage, string>> = {
      branchNotFound: {
        en: "I couldn't find that branch menu right now.",
        ar: "لم أتمكن من العثور على قائمة هذا الفرع الآن.",
      },
      spicyReply: {
        en: "Here are a few spicy options from the current menu.",
        ar: "هذه بعض الخيارات الحارة من القائمة الحالية.",
      },
      spicyReason: {
        en: "Marked as spicy or described as spicy in the menu.",
        ar: "مذكور في القائمة أنه حار أو موصوف كخيار حار.",
      },
      mildReply: {
        en: "Here are milder options from the current menu.",
        ar: "هذه خيارات أخف من القائمة الحالية.",
      },
      mildReason: {
        en: "This item is not marked or described as spicy in the menu.",
        ar: "هذا الصنف غير محدد أو موصوف كخيار حار في القائمة.",
      },
      vegetarianReply: {
        en: "Here are vegetarian options from the current menu.",
        ar: "هذه خيارات نباتية من القائمة الحالية.",
      },
      vegetarianReason: {
        en: "Marked as vegetarian or listed with vegetarian dietary info.",
        ar: "محدد كخيار نباتي أو يحتوي على معلومات غذائية نباتية.",
      },
      lightReply: {
        en: "These look like lighter-style options based on the menu descriptions.",
        ar: "هذه تبدو خيارات أخف بناء على وصف القائمة.",
      },
      lightReason: {
        en: "The menu category or description suggests a lighter style.",
        ar: "الفئة أو الوصف في القائمة يشير إلى خيار أخف.",
      },
      budgetReply: {
        en: "These are some of the lower-priced available options on the current menu.",
        ar: "هذه بعض الخيارات الأقل سعرا والمتاحة في القائمة الحالية.",
      },
      budgetReason: {
        en: "One of the lower-priced available options in this branch menu.",
        ar: "من الخيارات الأقل سعرا والمتاحة في قائمة هذا الفرع.",
      },
      kidsReply: {
        en: "These look like kid-friendly options based on the current menu.",
        ar: "هذه تبدو خيارات مناسبة للأطفال بناء على القائمة الحالية.",
      },
      kidsReason: {
        en: "The name, category, or description suggests a simple kid-friendly option.",
        ar: "الاسم أو الفئة أو الوصف يشير إلى خيار بسيط مناسب للأطفال.",
      },
      proteinReply: {
        en: "These look like higher-protein options from the current menu.",
        ar: "هذه تبدو خيارات أعلى بالبروتين من القائمة الحالية.",
      },
      proteinReason: {
        en: "The menu name, ingredients, or description includes common protein-rich foods.",
        ar: "الاسم أو المكونات أو الوصف يتضمن أطعمة معروفة بأنها غنية بالبروتين.",
      },
      fastReply: {
        en: "These should be among the quicker options based on listed preparation times.",
        ar: "هذه من الخيارات الأسرع بناء على أوقات التحضير المذكورة.",
      },
      fastReason: {
        en: "This item has one of the shorter listed preparation times.",
        ar: "هذا الصنف لديه وقت تحضير أقصر من غيره حسب القائمة.",
      },
      dessertReply: {
        en: "Here are sweet or dessert-style options from the current menu.",
        ar: "هذه خيارات حلويات أو أطباق حلوة من القائمة الحالية.",
      },
      dessertReason: {
        en: "The category, name, or description suggests a dessert or sweet option.",
        ar: "الفئة أو الاسم أو الوصف يشير إلى حلوى أو خيار حلو.",
      },
      drinkReply: {
        en: "Here are drink options from the current menu.",
        ar: "هذه خيارات مشروبات من القائمة الحالية.",
      },
      drinkReason: {
        en: "The category, name, or description suggests a drink.",
        ar: "الفئة أو الاسم أو الوصف يشير إلى مشروب.",
      },
      dairyReply: {
        en: "I found options that do not list dairy in the available allergen data.",
        ar: "وجدت خيارات لا تذكر مشتقات الحليب في بيانات الحساسية المتاحة.",
      },
      allergenReply: {
        en: "I found options that do not list that allergen in the available allergen data.",
        ar: "وجدت خيارات لا تذكر هذا المسبب للحساسية في بيانات الحساسية المتاحة.",
      },
      policyReply: {
        en: "I can answer from the current branch menu, but staff should confirm payment, discounts, policies, or service details.",
        ar: "يمكنني الإجابة من قائمة هذا الفرع، لكن يجب على الموظفين تأكيد تفاصيل الدفع أو الخصومات أو السياسات أو الخدمة.",
      },
      policySafety: {
        en: "Please ask staff to confirm payment, discount, policy, or service details.",
        ar: "يرجى سؤال الموظفين لتأكيد تفاصيل الدفع أو الخصم أو السياسة أو الخدمة.",
      },
      customReply: {
        en: "I can suggest menu items, but staff should confirm custom preparation or substitution requests.",
        ar: "يمكنني اقتراح أصناف من القائمة، لكن يجب على الموظفين تأكيد طلبات التخصيص أو الاستبدال.",
      },
      customSafety: {
        en: "Please ask staff to confirm custom preparation or substitutions.",
        ar: "يرجى سؤال الموظفين لتأكيد التخصيص أو الاستبدالات.",
      },
      ingredientMissing: {
        en: "I can help avoid an ingredient when it is listed in the menu data. Please ask staff if this is allergy-related.",
        ar: "يمكنني المساعدة في تجنب مكون عندما يكون مذكورا في بيانات القائمة. يرجى سؤال الموظفين إذا كان الأمر مرتبطا بالحساسية.",
      },
      ingredientReason: {
        en: "The available menu text does not mention this ingredient.",
        ar: "نص القائمة المتاح لا يذكر هذا المكون.",
      },
      pairingFallback: {
        en: "I found a few popular options that pair well with the current menu or cart.",
        ar: "وجدت بعض الخيارات الشائعة التي قد تناسب القائمة الحالية أو سلتك.",
      },
      popularFallback: {
        en: "I found a few popular options from the current menu.",
        ar: "وجدت بعض الخيارات الشائعة من القائمة الحالية.",
      },
      currentPairingFallback: {
        en: "I don't have enough pairing history for that yet, but these are available from the current menu.",
        ar: "لا توجد لدي بيانات كافية عن التوافق بعد، لكن هذه خيارات متاحة من القائمة الحالية.",
      },
      currentUnknownFallback: {
        en: "I can only answer from the current branch menu. Here are available options I found.",
        ar: "يمكنني الإجابة فقط من قائمة هذا الفرع. هذه خيارات متاحة وجدتها.",
      },
      currentFallback: {
        en: "I found a few options from the current branch menu.",
        ar: "وجدت بعض الخيارات من قائمة هذا الفرع.",
      },
      currentFallbackReason: {
        en: "Available on the current branch menu.",
        ar: "متاح في قائمة هذا الفرع.",
      },
    };

    return copy[key]?.[language] ?? copy[key]?.en ?? key;
  }

  private async loadConversationMemory(
    input: MenuChatRequest,
    branch: ScopedBranch,
  ): Promise<MenuChatConversationMemory | null> {
    if (!input.sessionId) return null;

    const latestLog = await this.prisma.menuChatLog.findFirst({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        sessionId: input.sessionId,
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });

    const metadata = latestLog?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    const memory = (metadata as Record<string, unknown>).conversationMemory;
    if (!memory || typeof memory !== "object" || Array.isArray(memory)) {
      return null;
    }

    return this.normalizeConversationMemory(memory as Record<string, unknown>);
  }

  private normalizeConversationMemory(
    raw: Record<string, unknown>,
  ): MenuChatConversationMemory {
    return {
      lastIntent: this.isMenuChatIntent(raw.lastIntent) ? raw.lastIntent : undefined,
      dietaryConstraints: this.stringList(raw.dietaryConstraints, 8),
      avoidedIngredients: this.stringList(raw.avoidedIngredients, 12),
      preferredAttributes: this.stringList(raw.preferredAttributes, 8),
      lastSuggestedItemIds: this.stringList(raw.lastSuggestedItemIds, 10),
      turns: typeof raw.turns === "number" && Number.isFinite(raw.turns) ? Math.min(raw.turns, 20) : 0,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  }

  private isMenuChatIntent(value: unknown): value is MenuChatIntent {
    return (
      typeof value === "string" &&
      [
        "GENERAL_RECOMMENDATION",
        "SPICY",
        "NOT_SPICY",
        "VEGETARIAN",
        "LIGHT",
        "PAIRING",
        "BUDGET_FRIENDLY",
        "KIDS_MEAL",
        "HIGH_PROTEIN",
        "FAST_PREP",
        "INGREDIENT_EXCLUSION",
        "DESSERT",
        "DRINK",
        "DAIRY_FREE",
        "ALLERGEN",
        "POLICY_OR_PAYMENT",
        "CUSTOM_PREPARATION",
        "UNKNOWN",
      ].includes(value)
    );
  }

  private stringList(value: unknown, limit: number) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().toLowerCase())
      .slice(0, limit);
  }

  private resolveIntent(
    detectedIntent: MenuChatIntent,
    message: string,
    memory: MenuChatConversationMemory | null,
  ): MenuChatIntent {
    if (detectedIntent !== "UNKNOWN") return detectedIntent;
    if (!memory?.lastIntent || !this.isFollowUpMessage(message)) return detectedIntent;
    if (
      memory.lastIntent === "ALLERGEN" ||
      memory.lastIntent === "INGREDIENT_EXCLUSION" ||
      memory.lastIntent === "POLICY_OR_PAYMENT" ||
      memory.lastIntent === "CUSTOM_PREPARATION"
    ) {
      return "GENERAL_RECOMMENDATION";
    }
    return memory.lastIntent;
  }

  private isFollowUpMessage(message: string) {
    return /\b(anything else|something else|another|other|more|else|cheaper|faster|without|no |not spicy|make it)\b/i.test(message);
  }

  private menuItemsForTurn(
    menuItems: MenuContextItem[],
    memory: MenuChatConversationMemory | null,
    followUp: boolean,
  ) {
    const previousSuggestions = followUp
      ? new Set(memory?.lastSuggestedItemIds ?? [])
      : new Set<string>();

    return menuItems.filter(
      (item) =>
        !previousSuggestions.has(item.id) &&
        this.itemAllowedByMemory(item, memory),
    );
  }

  private itemAllowedByMemory(
    item: MenuContextItem,
    memory: MenuChatConversationMemory | null,
  ) {
    if (!memory) return true;

    if (
      memory.avoidedIngredients.some((ingredient) =>
        this.mentionsIngredient(item, ingredient),
      )
    ) {
      return false;
    }

    if (memory.dietaryConstraints.includes("not_spicy") && this.isSpicy(item)) {
      return false;
    }
    if (memory.dietaryConstraints.includes("vegetarian") && !this.isVegetarian(item)) {
      return false;
    }
    if (memory.dietaryConstraints.includes("dairy_free")) {
      const allergens = this.allergenList(item);
      if (!allergens) return false;
      if (["dairy", "milk", "lactose", "cheese", "butter", "cream"].some((term) =>
        allergens.some((allergen) => allergen.includes(term)),
      )) {
        return false;
      }
    }

    return true;
  }

  private detectIntent(message: string): MenuChatIntent {
    const arabicIntent = this.detectArabicIntent(message);
    if (arabicIntent) return arabicIntent;

    if (INTENT_PATTERNS.DAIRY_FREE.test(message)) return "DAIRY_FREE";
    if (INTENT_PATTERNS.ALLERGEN.test(message)) return "ALLERGEN";
    if (INTENT_PATTERNS.POLICY_OR_PAYMENT.test(message)) return "POLICY_OR_PAYMENT";
    if (INTENT_PATTERNS.CUSTOM_PREPARATION.test(message)) return "CUSTOM_PREPARATION";
    if (INTENT_PATTERNS.NOT_SPICY.test(message)) return "NOT_SPICY";
    if (INTENT_PATTERNS.INGREDIENT_EXCLUSION.test(message)) return "INGREDIENT_EXCLUSION";
    if (INTENT_PATTERNS.BUDGET_FRIENDLY.test(message)) return "BUDGET_FRIENDLY";
    if (INTENT_PATTERNS.KIDS_MEAL.test(message)) return "KIDS_MEAL";
    if (INTENT_PATTERNS.HIGH_PROTEIN.test(message)) return "HIGH_PROTEIN";
    if (INTENT_PATTERNS.FAST_PREP.test(message)) return "FAST_PREP";
    if (INTENT_PATTERNS.DESSERT.test(message)) return "DESSERT";
    if (INTENT_PATTERNS.DRINK.test(message)) return "DRINK";
    if (INTENT_PATTERNS.PAIRING.test(message)) return "PAIRING";
    if (INTENT_PATTERNS.SPICY.test(message)) return "SPICY";
    if (INTENT_PATTERNS.VEGETARIAN.test(message)) return "VEGETARIAN";
    if (INTENT_PATTERNS.LIGHT.test(message)) return "LIGHT";
    if (INTENT_PATTERNS.GENERAL_RECOMMENDATION.test(message)) {
      return "GENERAL_RECOMMENDATION";
    }
    return "UNKNOWN";
  }

  private detectArabicIntent(message: string): MenuChatIntent | null {
    if (!/[\u0600-\u06FF]/.test(message)) return null;
    if (/(حساسية|جلوتين|غلوتين|مكسرات|فول سوداني|بيض|صويا|سمسم|محار)/.test(message)) return "ALLERGEN";
    if (/(بدون حليب|بدون لبن|بدون جبن|لاكتوز|خالي من الحليب|مشتقات الحليب)/.test(message)) return "DAIRY_FREE";
    if (/(دفع|بطاقة|كاش|نقد|خصم|كوبون|سياسة|حجز|ساعات|واي فاي|موقف|بقشيش|رسوم خدمة)/.test(message)) return "POLICY_OR_PAYMENT";
    if (/(تخصيص|بدل|استبدال|صلصة زيادة|على جنب|بدون ملح|اطبخ|تحضير خاص)/.test(message)) return "CUSTOM_PREPARATION";
    if (/(غير حار|بدون حار|بدون شطة|خفيف الحرارة)/.test(message)) return "NOT_SPICY";
    if (/(رخيص|أرخص|اقل سعر|أقل سعر|ميزانية|اقتصادي)/.test(message)) return "BUDGET_FRIENDLY";
    if (/(أطفال|اطفال|طفل|للأطفال|للاطفال)/.test(message)) return "KIDS_MEAL";
    if (/(بروتين|دجاج|لحم|سمك)/.test(message)) return "HIGH_PROTEIN";
    if (/(سريع|أسرع|اسرع|وقت التحضير|جاهز بسرعة)/.test(message)) return "FAST_PREP";
    if (/(حلويات|حلو|كيك|ايس كريم|آيس كريم)/.test(message)) return "DESSERT";
    if (/(مشروب|مشروبات|عصير|قهوة|شاي|كولا|ماء)/.test(message)) return "DRINK";
    if (/(يناسب|مع السلة|مع الطلب|بجانب|طبق جانبي)/.test(message)) return "PAIRING";
    if (/(حار|شطة|سبايسي)/.test(message)) return "SPICY";
    if (/(نباتي|بدون لحم|فيجن|فيغان)/.test(message)) return "VEGETARIAN";
    if (/(خفيف|صحي|طازج|سلطة)/.test(message)) return "LIGHT";
    if (/(اقترح|تنصح|توصي|الأفضل|افضل|شائع|ماذا آكل)/.test(message)) return "GENERAL_RECOMMENDATION";
    return null;
  }

  private localResponse(input: {
    intent: MenuChatIntent;
    message: string;
    menuItems: MenuContextItem[];
    cartItemIds: Set<string>;
    language: MenuChatLanguage;
  }): MenuChatResponse {
    const available = input.menuItems.filter(
      (item) => !input.cartItemIds.has(item.id),
    );

    switch (input.intent) {
      case "SPICY":
        return this.fromItems(
          this.t(input.language, "spicyReply"),
          available.filter((item) => this.isSpicy(item)),
          this.t(input.language, "spicyReason"),
          input.language,
        );
      case "NOT_SPICY":
        return this.fromItems(
          this.t(input.language, "mildReply"),
          available.filter((item) => !this.isSpicy(item)),
          this.t(input.language, "mildReason"),
          input.language,
        );
      case "VEGETARIAN":
        return this.fromItems(
          this.t(input.language, "vegetarianReply"),
          available.filter((item) => this.isVegetarian(item)),
          this.t(input.language, "vegetarianReason"),
          input.language,
        );
      case "LIGHT":
        return this.fromItems(
          this.t(input.language, "lightReply"),
          available.filter((item) => this.looksLight(item)),
          this.t(input.language, "lightReason"),
          input.language,
        );
      case "BUDGET_FRIENDLY":
        return this.fromItems(
          this.t(input.language, "budgetReply"),
          [...available].sort((a, b) => a.price.comparedTo(b.price)),
          this.t(input.language, "budgetReason"),
          input.language,
        );
      case "KIDS_MEAL":
        return this.fromItems(
          this.t(input.language, "kidsReply"),
          available.filter((item) => this.looksKidFriendly(item)),
          this.t(input.language, "kidsReason"),
          input.language,
        );
      case "HIGH_PROTEIN":
        return this.fromItems(
          this.t(input.language, "proteinReply"),
          available.filter((item) => this.looksHighProtein(item)),
          this.t(input.language, "proteinReason"),
          input.language,
        );
      case "FAST_PREP":
        return this.fromItems(
          this.t(input.language, "fastReply"),
          this.fastPrepItems(available),
          this.t(input.language, "fastReason"),
          input.language,
        );
      case "INGREDIENT_EXCLUSION": {
        const excluded = this.extractExcludedIngredient(input.message);
        if (!excluded) {
          return this.withStaffHelp(
            {
              reply: this.t(input.language, "ingredientMissing"),
              suggestedItems: [],
              safetyNotes: [],
              language: input.language,
            },
            "INGREDIENT_UNCERTAIN",
            this.allergenSafetyNote(input.language),
          );
        }
        return this.withStaffHelp(
          this.fromItems(
            input.language === "ar"
              ? `وجدت خيارات لا تذكر ${excluded} في نص القائمة المتاح.`
              : `I found options that do not mention ${excluded} in the available menu text.`,
            available.filter((item) => !this.mentionsIngredient(item, excluded)),
            input.language === "ar"
              ? this.t(input.language, "ingredientReason")
              : `The available menu text does not mention ${excluded}.`,
            input.language,
          ),
          "INGREDIENT_UNCERTAIN",
          this.allergenSafetyNote(input.language),
        );
      }
      case "DESSERT":
        return this.fromItems(
          this.t(input.language, "dessertReply"),
          available.filter((item) => this.looksDessert(item)),
          this.t(input.language, "dessertReason"),
          input.language,
        );
      case "DRINK":
        return this.fromItems(
          this.t(input.language, "drinkReply"),
          available.filter((item) => this.looksDrink(item)),
          this.t(input.language, "drinkReason"),
          input.language,
        );
      case "DAIRY_FREE":
        return this.allergenResponse({
          reply: this.t(input.language, "dairyReply"),
          allergenTerms: ["dairy", "milk", "lactose", "cheese", "butter", "cream"],
          items: available,
          language: input.language,
        });
      case "ALLERGEN":
        return this.allergenResponse({
          reply: this.t(input.language, "allergenReply"),
          allergenTerms: this.extractAllergenTerms(input.message),
          items: available,
          language: input.language,
        });
      case "POLICY_OR_PAYMENT":
        return this.withStaffHelp(
          {
            reply: this.t(input.language, "policyReply"),
            suggestedItems: [],
            safetyNotes: [],
            language: input.language,
          },
          "POLICY_OR_PAYMENT",
          this.t(input.language, "policySafety"),
        );
      case "CUSTOM_PREPARATION":
        return this.withStaffHelp(
          {
            reply: this.t(input.language, "customReply"),
            suggestedItems: [],
            safetyNotes: [],
            language: input.language,
          },
          "CUSTOM_PREPARATION",
          this.t(input.language, "customSafety"),
        );
      case "PAIRING":
      case "GENERAL_RECOMMENDATION":
      case "UNKNOWN":
        return { reply: "", suggestedItems: [], safetyNotes: [], language: input.language };
    }
  }

  private fromItems(
    reply: string,
    items: MenuContextItem[],
    reason: string,
    language: MenuChatLanguage = "en",
  ): MenuChatResponse {
    return {
      reply,
      suggestedItems: items.slice(0, 5).map((item) => ({
        menuItemId: item.id,
        name: item.name,
        reason,
      })),
      safetyNotes: [],
      language,
    };
  }

  private allergenResponse(input: {
    reply: string;
    allergenTerms: string[];
    items: MenuContextItem[];
    language: MenuChatLanguage;
  }): MenuChatResponse {
    if (input.allergenTerms.length === 0) {
      return this.withStaffHelp(
        { reply: this.allergenSafetyNote(input.language), suggestedItems: [], safetyNotes: [], language: input.language },
        "ALLERGEN_UNCERTAIN",
        this.allergenSafetyNote(input.language),
      );
    }

    const withExplicitAllergenData = input.items.filter(
      (item) => this.allergenList(item) !== null,
    );
    if (withExplicitAllergenData.length === 0) {
      return this.withStaffHelp(
        { reply: this.allergenSafetyNote(input.language), suggestedItems: [], safetyNotes: [], language: input.language },
        "ALLERGEN_UNCERTAIN",
        this.allergenSafetyNote(input.language),
      );
    }

    const matchingItems = withExplicitAllergenData.filter((item) => {
      const allergens = this.allergenList(item) ?? [];
      return !input.allergenTerms.some((term) =>
        allergens.some((allergen) => allergen.includes(term)),
      );
    });

    return this.withStaffHelp(
      {
        reply: matchingItems.length > 0 ? input.reply : this.allergenSafetyNote(input.language),
        suggestedItems: matchingItems.slice(0, 5).map((item) => ({
          menuItemId: item.id,
          name: item.name,
          reason:
            input.language === "ar"
              ? "هذا الصنف لديه بيانات حساسية واضحة ولا يذكر مسبب الحساسية الذي سألت عنه."
              : "This item has explicit allergen data and does not list the allergen you asked about.",
        })),
        safetyNotes: [],
        language: input.language,
      },
      "ALLERGEN_UNCERTAIN",
      this.allergenSafetyNote(input.language),
    );
  }

  private allergenSafetyNote(language: MenuChatLanguage) {
    return language === "ar" ? AR_ALLERGEN_SAFETY_NOTE : ALLERGEN_SAFETY_NOTE;
  }

  private withStaffHelp(
    response: MenuChatResponse,
    reason: MenuChatStaffHelpReason,
    safetyNote: string,
  ): MenuChatResponse {
    const safetyNotes = [...(response.safetyNotes ?? []), safetyNote]
      .filter((note, index, notes) => notes.indexOf(note) === index)
      .slice(0, 3);

    return {
      ...response,
      safetyNotes,
      requiresStaffHelp: true,
      staffHelpReason: reason,
    };
  }

  private isSpicy(item: MenuContextItem) {
    return (
      item.isSpicy ||
      this.textFields(item).some((text) => /\b(spicy|hot|chilli|chili)\b/i.test(text))
    );
  }

  private isVegetarian(item: MenuContextItem) {
    return (
      item.isVegetarian ||
      /\b(vegetarian|vegan|plant.?based|meatless)\b/i.test(
        item.dietaryInfo ?? "",
      )
    );
  }

  private looksLight(item: MenuContextItem) {
    const combined = [
      item.category.name,
      item.description,
      item.dietaryInfo,
    ]
      .filter(Boolean)
      .join(" ");
    return /\b(light|fresh|salad|starter|juice|vegetarian|grilled)\b/i.test(combined);
  }

  private looksKidFriendly(item: MenuContextItem) {
    return this.textFields(item).some((text) =>
      /\b(kid|kids|mini|small|burger|pasta|fries|chicken|juice|cheese)\b/i.test(text),
    );
  }

  private looksHighProtein(item: MenuContextItem) {
    return this.textFields(item).some((text) =>
      /\b(protein|chicken|beef|steak|fish|salmon|tuna|egg|eggs|meat|grilled|burger)\b/i.test(text),
    );
  }

  private fastPrepItems(items: MenuContextItem[]) {
    const withPrepTime = items.filter((item) => item.prepTimeMinutes !== null);
    if (withPrepTime.length === 0) return [];

    return [...withPrepTime].sort(
      (a, b) => (a.prepTimeMinutes ?? 999) - (b.prepTimeMinutes ?? 999),
    );
  }

  private looksDessert(item: MenuContextItem) {
    return this.textFields(item).some((text) =>
      /\b(dessert|sweet|cake|ice cream|brownie|cookie|pudding|chocolate)\b/i.test(text),
    );
  }

  private looksDrink(item: MenuContextItem) {
    return this.textFields(item).some((text) =>
      /\b(drink|beverage|juice|soda|cola|coffee|tea|water|smoothie)\b/i.test(text),
    );
  }

  private extractExcludedIngredient(message: string) {
    const match = message.match(INTENT_PATTERNS.INGREDIENT_EXCLUSION);
    if (!match?.[2]) return null;

    return match[2]
      .toLowerCase()
      .replace(/\b(on|in|from|please|thanks|thank you|my|the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");
  }

  private mentionsIngredient(item: MenuContextItem, ingredient: string) {
    const normalized = ingredient.toLowerCase();
    return this.textFields(item).some((text) => text.toLowerCase().includes(normalized));
  }

  private textFields(item: MenuContextItem) {
    return [
      item.name,
      item.description ?? "",
      item.ingredients ?? "",
      item.dietaryInfo ?? "",
      item.category.name,
    ];
  }

  private allergenList(item: MenuContextItem): string[] | null {
    const raw = item.allergensJson;
    if (raw === null) return null;

    if (Array.isArray(raw)) {
      return raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase());
    }

    if (typeof raw === "string") {
      return [raw.toLowerCase()];
    }

    return null;
  }

  private extractAllergenTerms(message: string) {
    const known = [
      "dairy",
      "milk",
      "lactose",
      "gluten",
      "nut",
      "peanut",
      "egg",
      "soy",
      "sesame",
      "shellfish",
    ];
    const normalized = message.toLowerCase();
    return known.filter((term) => normalized.includes(term));
  }

  private shouldUseRecommendationFallback(
    intent: MenuChatIntent,
    result: MenuChatResponse,
  ) {
    if ((result.safetyNotes ?? []).length > 0) return false;
    if (
      intent === "GENERAL_RECOMMENDATION" ||
      intent === "PAIRING" ||
      intent === "UNKNOWN"
    ) {
      return true;
    }
    return (
      result.suggestedItems.length === 0 &&
      (
        intent === "SPICY" ||
        intent === "NOT_SPICY" ||
        intent === "LIGHT" ||
        intent === "KIDS_MEAL" ||
        intent === "HIGH_PROTEIN" ||
        intent === "FAST_PREP" ||
        intent === "DESSERT" ||
        intent === "DRINK"
      )
    );
  }

  private shouldUseAiBoundary(
    intent: MenuChatIntent,
    result: MenuChatResponse,
  ) {
    if ((result.safetyNotes ?? []).length > 0) return false;
    if (result.suggestedItems.length === 0) return false;
    return (
      intent === "SPICY" ||
      intent === "NOT_SPICY" ||
      intent === "VEGETARIAN" ||
      intent === "LIGHT" ||
      intent === "BUDGET_FRIENDLY" ||
      intent === "KIDS_MEAL" ||
      intent === "HIGH_PROTEIN" ||
      intent === "FAST_PREP" ||
      intent === "DESSERT" ||
      intent === "DRINK"
    );
  }

  private shouldUseLlmBoundary(
    result: MenuChatResponse,
    menuItems: MenuContextItem[],
  ) {
    if (!this.menuChatLlmService) return false;
    if ((result.safetyNotes ?? []).length > 0) return false;
    return menuItems.length > 0;
  }

  private recommendationCartItems(input: {
    intent: MenuChatIntent;
    message: string;
    menuItems: MenuContextItem[];
    cartItems: NonNullable<MenuChatRequest["cartItems"]>;
  }) {
    if (input.intent !== "PAIRING" || input.cartItems.length > 0) {
      return input.cartItems;
    }

    const matchedItem = this.findMentionedMenuItem(input.message, input.menuItems);
    if (!matchedItem) return input.cartItems;

    return [{ menuItemId: matchedItem.id, quantity: 1 }];
  }

  private findMentionedMenuItem(
    message: string,
    menuItems: MenuContextItem[],
  ): MenuContextItem | null {
    const normalized = message.toLowerCase();
    const exactMatch = [...menuItems]
      .sort((a, b) => b.name.length - a.name.length)
      .find((item) => normalized.includes(item.name.toLowerCase()));
    if (exactMatch) return exactMatch;

    return (
      menuItems.find((item) =>
        item.name
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length >= 4)
          .some((word) => normalized.includes(word)),
      ) ?? null
    );
  }

  private async recommendationFallback(input: {
    input: MenuChatRequest;
    branch: ScopedBranch;
    userId?: string;
    cartItems: NonNullable<MenuChatRequest["cartItems"]>;
    menuItems: MenuContextItem[];
  }): Promise<MenuChatSuggestedItem[]> {
    const response = await this.recommendationService.getMenuRecommendations({
      tenantId: input.branch.tenantId,
      branchId: input.branch.id,
      userId: input.userId,
      sessionId: input.input.sessionId,
      cartItems: input.cartItems,
      limit: 5,
    });
    const allowedIds = new Set(input.menuItems.map((item) => item.id));

    return response.recommendations
      .filter((item) => allowedIds.has(item.menuItemId))
      .map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        reason: item.reason,
      }));
  }

  private currentMenuFallback(input: {
    intent: MenuChatIntent;
    menuItems: MenuContextItem[];
    cartItemIds: Set<string>;
    language: MenuChatLanguage;
  }): MenuChatResponse {
    const available = input.menuItems.filter(
      (item) => !input.cartItemIds.has(item.id),
    );

    return this.fromItems(
      this.currentMenuFallbackReply(input.intent, input.language),
      available,
      this.t(input.language, "currentFallbackReason"),
      input.language,
    );
  }

  private currentMenuFallbackReply(intent: MenuChatIntent, language: MenuChatLanguage) {
    if (intent === "PAIRING") {
      return this.t(language, "currentPairingFallback");
    }
    if (intent === "UNKNOWN") {
      return this.t(language, "currentUnknownFallback");
    }
    return this.t(language, "currentFallback");
  }

  private async tryLlmMenuChat(input: {
    branch: ScopedBranch;
    message: string;
    menuItems: MenuContextItem[];
    cartItemIds: Set<string>;
    language: MenuChatLanguage;
    timeoutMs: number;
    tone: MenuChatControls["assistantTone"];
  }): Promise<ProviderValidationResult | null> {
    if (!this.menuChatLlmService) return null;

    const response = await this.menuChatLlmService.chat({
      branchName: input.branch.name,
      message: input.message,
      cartItemIds: [...input.cartItemIds],
      language: input.language,
      timeoutMs: input.timeoutMs,
      tone: input.tone,
      menuItems: input.menuItems.slice(0, 120).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        ingredients: item.ingredients,
        dietaryInfo: item.dietaryInfo,
        allergens: this.allergenList(item),
        isVegetarian: item.isVegetarian,
        isSpicy: item.isSpicy,
        prepTimeMinutes: item.prepTimeMinutes,
        price: item.price.toString(),
        categoryName: item.category.name,
      })),
    });

    if (!response) return null;
    return this.filterLlmResponse(response, input.menuItems, input.cartItemIds, input.language);
  }

  private filterLlmResponse(
    data: MenuChatLlmResponse,
    menuItems: MenuContextItem[],
    cartItemIds: Set<string>,
    language: MenuChatLanguage,
  ): ProviderValidationResult {
    const structuralRejection = this.validateProviderEnvelope(data);
    if (structuralRejection) return { response: null, rejectionReason: structuralRejection };

    const claimRejection = this.unsupportedClaimReason(data);
    if (claimRejection) return { response: null, rejectionReason: claimRejection };

    const itemById = new Map(menuItems.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const suggestedItems: MenuChatSuggestedItem[] = [];
    let rejectedUnknownItem = false;
    let rejectedCartItem = false;

    for (const candidate of data.suggestedItems) {
      if (seen.has(candidate.menuItemId) || cartItemIds.has(candidate.menuItemId)) {
        rejectedCartItem = true;
        continue;
      }

      const menuItem = itemById.get(candidate.menuItemId);
      if (!menuItem) {
        rejectedUnknownItem = true;
        continue;
      }

      suggestedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        reason: candidate.reason.slice(0, 160),
      });
      seen.add(menuItem.id);
      if (suggestedItems.length >= 5) break;
    }

    if (data.suggestedItems.length > 0 && suggestedItems.length === 0) {
      return {
        response: null,
        rejectionReason: rejectedUnknownItem
          ? "unknown_item_id"
          : rejectedCartItem
            ? "cart_item_suggestion"
            : "empty_suggestions",
      };
    }

    return {
      response: {
        reply: data.reply.slice(0, 500),
        suggestedItems,
        safetyNotes: data.safetyNotes.slice(0, 3),
        language,
      },
    };
  }

  private async tryAiMenuChat(input: {
    message: string;
    menuItems: MenuContextItem[];
    cartItemIds: Set<string>;
    language: MenuChatLanguage;
    timeoutMs: number;
    tone: MenuChatControls["assistantTone"];
    allowedSuggestionIds: Set<string>;
  }): Promise<ProviderValidationResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await fetch(`${env.aiServiceUrl}/menu-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.message,
          language: input.language,
          tone: input.tone,
          menuItems: input.menuItems.map((item) => ({
            menuItemId: item.id,
            name: item.name,
            description: item.description,
            dietaryInfo: item.dietaryInfo,
            allergens: this.allergenList(item),
            isVegetarian: item.isVegetarian,
            isSpicy: item.isSpicy,
            category: item.category.name,
            isAvailable: true,
          })),
          cartItems: [...input.cartItemIds].map((menuItemId) => ({
            menuItemId,
            quantity: 1,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as AiMenuChatResponse;
      return this.filterAiResponse(
        data,
        input.menuItems,
        input.cartItemIds,
        input.allowedSuggestionIds,
        input.language,
      );
    } catch (error) {
      this.logger.debug(
        `Menu chat AI boundary unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private filterAiResponse(
    data: AiMenuChatResponse,
    menuItems: MenuContextItem[],
    cartItemIds: Set<string>,
    allowedSuggestionIds: Set<string>,
    language: MenuChatLanguage,
  ): ProviderValidationResult {
    if (typeof data.reply !== "string" || !Array.isArray(data.suggestedItems)) {
      return { response: null, rejectionReason: "invalid_json_shape" };
    }

    const safetyNotes = Array.isArray(data.safetyNotes)
      ? data.safetyNotes.filter((note): note is string => typeof note === "string")
      : [];
    const structuralRejection = this.validateProviderEnvelope({
      reply: data.reply,
      suggestedItems: data.suggestedItems
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          menuItemId: typeof item.menuItemId === "string" ? item.menuItemId : "",
          reason: typeof item.reason === "string" ? item.reason : "",
        })),
      safetyNotes,
    });
    if (structuralRejection) return { response: null, rejectionReason: structuralRejection };

    const claimRejection = this.unsupportedClaimReason({
      reply: data.reply,
      suggestedItems: data.suggestedItems
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          menuItemId: typeof item.menuItemId === "string" ? item.menuItemId : "",
          reason: typeof item.reason === "string" ? item.reason : "",
        })),
      safetyNotes,
    });
    if (claimRejection) return { response: null, rejectionReason: claimRejection };

    const itemById = new Map(menuItems.map((item) => [item.id, item]));
    const suggestedItems: MenuChatSuggestedItem[] = [];
    const seen = new Set<string>();
    let rejectedUnknownItem = false;

    for (const rawItem of data.suggestedItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const candidate = rawItem as Record<string, unknown>;
      const menuItemId = candidate.menuItemId;
      if (typeof menuItemId !== "string") continue;
      if (seen.has(menuItemId) || cartItemIds.has(menuItemId)) continue;
      if (!allowedSuggestionIds.has(menuItemId)) {
        rejectedUnknownItem = true;
        continue;
      }

      const menuItem = itemById.get(menuItemId);
      if (!menuItem) {
        rejectedUnknownItem = true;
        continue;
      }

      suggestedItems.push({
        menuItemId,
        name: menuItem.name,
        reason:
          typeof candidate.reason === "string" && candidate.reason.trim()
            ? candidate.reason.slice(0, 160)
            : "Suggested from the current menu.",
      });
      seen.add(menuItemId);
      if (suggestedItems.length >= 5) break;
    }

    if (suggestedItems.length === 0) {
      return {
        response: null,
        rejectionReason: rejectedUnknownItem ? "unknown_item_id" : "empty_suggestions",
      };
    }

    return {
      response: {
        reply: data.reply.slice(0, 500),
        suggestedItems,
        safetyNotes: safetyNotes.slice(0, 3),
        language,
      },
    };
  }

  private validateProviderEnvelope(data: {
    reply: string;
    suggestedItems: Array<{ menuItemId: string; reason: string }>;
    safetyNotes: string[];
  }) {
    const reply = data.reply.trim();
    if (!reply) return "empty_reply";
    if (reply.length > 700) return "reply_too_long";
    if (data.suggestedItems.length > 5) return "too_many_suggestions";
    if (data.safetyNotes.length > 3) return "too_many_safety_notes";

    for (const item of data.suggestedItems) {
      if (!item.menuItemId.trim()) return "invalid_suggestion_shape";
      if (!item.reason.trim()) return "invalid_suggestion_shape";
      if (item.reason.length > 220) return "reason_too_long";
    }

    for (const note of data.safetyNotes) {
      if (note.length > 220) return "safety_note_too_long";
    }

    return undefined;
  }

  private unsupportedClaimReason(data: {
    reply: string;
    suggestedItems: Array<{ reason: string }>;
    safetyNotes: string[];
  }) {
    const text = [
      data.reply,
      ...data.suggestedItems.map((item) => item.reason),
      ...data.safetyNotes,
    ].join(" ");

    if (/\b(discount|coupon|promo|promotion|free meal|policy|refund|payment)\b/i.test(text)) {
      return "unsupported_policy_or_discount_claim";
    }
    if (/\b(calorie|calories|kcal|macro|macros|carb|carbs)\b/i.test(text)) {
      return "unsupported_nutrition_claim";
    }
    if (/\b(JOD|USD|\$|€|£|price is|costs?|cheaper than)\b/i.test(text)) {
      return "unsupported_price_claim";
    }
    if (/\b(allergen.?free|gluten.?free|nut.?free|dairy.?free|safe for allergies|does not contain)\b/i.test(text)) {
      return "unsupported_allergen_claim";
    }

    return undefined;
  }

  private nextConversationMemory(input: {
    priorMemory: MenuChatConversationMemory | null;
    detectedIntent: MenuChatIntent;
    resolvedIntent: MenuChatIntent;
    message: string;
    suggestedItems: MenuChatSuggestedItem[];
  }): MenuChatConversationMemory {
    const prior = input.priorMemory ?? {
      dietaryConstraints: [],
      avoidedIngredients: [],
      preferredAttributes: [],
      lastSuggestedItemIds: [],
      turns: 0,
      updatedAt: new Date().toISOString(),
    };

    const dietaryConstraints = new Set(prior.dietaryConstraints);
    const avoidedIngredients = new Set(prior.avoidedIngredients);
    const preferredAttributes = new Set(prior.preferredAttributes);

    if (input.resolvedIntent === "VEGETARIAN") dietaryConstraints.add("vegetarian");
    if (input.resolvedIntent === "NOT_SPICY") dietaryConstraints.add("not_spicy");
    if (input.resolvedIntent === "DAIRY_FREE") dietaryConstraints.add("dairy_free");
    if (input.resolvedIntent === "LIGHT") preferredAttributes.add("light");
    if (input.resolvedIntent === "BUDGET_FRIENDLY") preferredAttributes.add("budget_friendly");
    if (input.resolvedIntent === "KIDS_MEAL") preferredAttributes.add("kids_meal");
    if (input.resolvedIntent === "HIGH_PROTEIN") preferredAttributes.add("high_protein");
    if (input.resolvedIntent === "FAST_PREP") preferredAttributes.add("fast_prep");

    const excludedIngredient = this.extractExcludedIngredient(input.message);
    if (excludedIngredient) avoidedIngredients.add(excludedIngredient);

    const allergenTerms = this.extractAllergenTerms(input.message);
    for (const term of allergenTerms) avoidedIngredients.add(term);

    return {
      lastIntent: input.resolvedIntent === "UNKNOWN" ? prior.lastIntent : input.resolvedIntent,
      dietaryConstraints: [...dietaryConstraints].slice(-8),
      avoidedIngredients: [...avoidedIngredients].slice(-12),
      preferredAttributes: [...preferredAttributes].slice(-8),
      lastSuggestedItemIds: input.suggestedItems.map((item) => item.menuItemId).slice(0, 10),
      turns: Math.min(prior.turns + 1, 20),
      updatedAt: new Date().toISOString(),
    };
  }

  private fallbackReply(intent: MenuChatIntent, language: MenuChatLanguage) {
    if (intent === "PAIRING") {
      return this.t(language, "pairingFallback");
    }
    return this.t(language, "popularFallback");
  }

  private async logChat(input: {
    branch: ScopedBranch;
    input: MenuChatRequest;
    effectiveUserId?: string;
    detectedIntent: MenuChatIntent;
    resolvedIntent: MenuChatIntent;
    suggestedItems: MenuChatSuggestedItem[];
    safetyNotes?: string[];
    requiresStaffHelp?: boolean;
    staffHelpReason?: MenuChatStaffHelpReason;
    language: MenuChatLanguage;
    usedAiService: boolean;
    aiProvider?: string;
    providerRejectionReason?: string;
    usedFallback: boolean;
    conversationMemory: MenuChatConversationMemory;
    memoryApplied: boolean;
    controlMode?: string;
    responseShaping?: {
      assistantTone: MenuChatControls["assistantTone"];
      maxSuggestions: number;
      maxResponseLength: number;
    };
  }) {
    try {
      const message = input.input.message.trim();
      const messageHash = crypto
        .createHash("sha256")
        .update(message)
        .digest("hex");

      await this.prisma.menuChatLog.create({
        data: {
          tenantId: input.branch.tenantId,
          branchId: input.branch.id,
          userId: input.effectiveUserId,
          sessionId: input.input.sessionId,
          messageIntent: input.resolvedIntent,
          messageHash,
          messagePreview: message.slice(0, 80),
          suggestedItemIds: input.suggestedItems.map((item) => item.menuItemId),
          safetyNotes: input.safetyNotes ?? [],
          usedAiService: input.usedAiService,
          usedFallback: input.usedFallback,
          metadata: this.toInputJsonObject({
            algorithmVersion: "menu-chat-rule-v1",
            aiProvider: input.aiProvider,
            providerRejectionReason: input.providerRejectionReason,
            llmModel: input.aiProvider === "huggingface" ? env.hfModel : undefined,
            cartItemIds: (input.input.cartItems ?? []).map((item) => item.menuItemId),
            suppliedUserId: input.input.userId,
            requiresStaffHelp: Boolean(input.requiresStaffHelp),
            staffHelpReason: input.staffHelpReason,
            language: input.language,
            detectedIntent: input.detectedIntent,
            resolvedIntent: input.resolvedIntent,
            memoryApplied: input.memoryApplied,
            conversationMemory: input.conversationMemory,
            controlMode: input.controlMode,
            responseShaping: input.responseShaping,
          }),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write menu chat log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
