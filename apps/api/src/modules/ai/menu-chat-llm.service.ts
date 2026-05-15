import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env.js";
import { extractJsonObjectText } from "./ai-output-validation.js";

export interface MenuChatLlmMenuItem {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  dietaryInfo: string | null;
  allergens: string[] | null;
  isVegetarian: boolean;
  isSpicy: boolean;
  prepTimeMinutes: number | null;
  price: string;
  categoryName: string;
}

export interface MenuChatLlmInput {
  branchName: string;
  message: string;
  menuItems: MenuChatLlmMenuItem[];
  cartItemIds: string[];
  language: "en" | "ar";
  timeoutMs?: number;
  tone?: "concise" | "friendly" | "formal";
}

export interface MenuChatLlmSuggestedItem {
  menuItemId: string;
  reason: string;
}

export interface MenuChatLlmResponse {
  reply: string;
  suggestedItems: MenuChatLlmSuggestedItem[];
  safetyNotes: string[];
}

interface HuggingFaceChatCompletion {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

@Injectable()
export class MenuChatLlmService {
  private readonly logger = new Logger(MenuChatLlmService.name);
  private loggedMissingToken = false;

  async chat(input: MenuChatLlmInput): Promise<MenuChatLlmResponse | null> {
    if (!env.hfToken) {
      if (!this.loggedMissingToken) {
        this.logger.debug("Hugging Face menu chat disabled: HF_TOKEN is not configured");
        this.loggedMissingToken = true;
      }
      return null;
    }

    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 4500, 750), 10_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${env.hfBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.hfToken}`,
        },
        body: JSON.stringify({
          model: env.hfModel,
          temperature: 0.2,
          max_tokens: 450,
          messages: [
            {
              role: "system",
              content: this.systemPrompt(),
            },
            {
              role: "user",
              content: JSON.stringify({
                branchName: input.branchName,
                customerQuestion: input.message,
                language: input.language,
                tone: input.tone ?? "concise",
                cartItemIds: input.cartItemIds,
                menuItems: input.menuItems,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPreview = (await response.text()).slice(0, 240);
        this.logger.debug(
          `Hugging Face menu chat failed: HTTP ${response.status} model=${env.hfModel} ${errorPreview}`,
        );
        return null;
      }

      const data = (await response.json()) as HuggingFaceChatCompletion;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") return null;

      return this.parseResponse(content);
    } catch (error) {
      this.logger.debug(
        `Hugging Face menu chat unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private systemPrompt() {
    return [
      "You are a customer-facing menu assistant for one restaurant branch.",
      "Answer only using the provided JSON menu context.",
      "Never invent menu items, prices, allergens, ingredients, discounts, availability, dietary labels, or policies.",
      "Use menuItemId values exactly as provided when suggesting items.",
      "If the answer is not present in the context, say you cannot confirm it from the available menu data.",
      "For allergen or strict dietary safety, be conservative and add a safety note telling the customer to ask staff when data is missing or uncertain.",
      "Reply in the requested language. If language is ar, use Arabic for prose while keeping menu item names exactly as provided.",
      "Follow the requested tone: concise means short and direct, friendly means warm but still brief, formal means polite and professional.",
      'Return only JSON with this exact shape: {"reply":"string","suggestedItems":[{"menuItemId":"string","reason":"string"}],"safetyNotes":["string"]}.',
    ].join(" ");
  }

  private parseResponse(content: string): MenuChatLlmResponse | null {
    try {
      const parsed = JSON.parse(this.extractJson(content)) as unknown;
      if (!parsed || typeof parsed !== "object") return null;

      const record = parsed as Record<string, unknown>;
      if (typeof record.reply !== "string" || !record.reply.trim()) return null;
      if (!Array.isArray(record.suggestedItems)) return null;

      const suggestedItems = record.suggestedItems
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
        .map((item) => ({
          menuItemId: typeof item.menuItemId === "string" ? item.menuItemId : "",
          reason: typeof item.reason === "string" ? item.reason : "",
        }))
        .filter((item) => item.menuItemId && item.reason.trim());

      const safetyNotes = Array.isArray(record.safetyNotes)
        ? record.safetyNotes
            .filter((note): note is string => typeof note === "string" && note.trim().length > 0)
        : [];

      return {
        reply: record.reply.slice(0, 1000),
        suggestedItems,
        safetyNotes,
      };
    } catch {
      return null;
    }
  }

  private extractJson(content: string) {
    return extractJsonObjectText(content);
  }
}
