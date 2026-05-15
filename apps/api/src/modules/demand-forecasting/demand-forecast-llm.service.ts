import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env.js";
import {
  extractJsonObjectText,
  validateDemandForecastLlmSummaryPayload,
} from "../ai/ai-output-validation.js";

export interface DemandForecastLlmInput {
  expectedOrders: number;
  expectedRevenue: number;
  peakHour: number | null;
  topItems: { name: string; quantity: number }[];
  weatherAdjustment: number;
  eventAdjustment: number;
}

export interface DemandForecastLlmResponse {
  summary: string;
}

interface HuggingFaceChatCompletion {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

@Injectable()
export class DemandForecastLlmService {
  private readonly logger = new Logger(DemandForecastLlmService.name);
  private loggedMissingToken = false;

  async generateSummary(input: DemandForecastLlmInput): Promise<string | null> {
    if (!env.hfToken) {
      if (!this.loggedMissingToken) {
        this.logger.debug("Hugging Face forecast LLM disabled: HF_TOKEN is not configured");
        this.loggedMissingToken = true;
      }
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(`${env.hfBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.hfToken}`,
        },
        body: JSON.stringify({
          model: env.hfModel,
          temperature: 0.3,
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: this.systemPrompt(),
            },
            {
              role: "user",
              content: JSON.stringify(input),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPreview = (await response.text()).slice(0, 240);
        this.logger.debug(
          `Hugging Face forecast LLM failed: HTTP ${response.status} model=${env.hfModel} ${errorPreview}`,
        );
        return null;
      }

      const data = (await response.json()) as HuggingFaceChatCompletion;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        this.logger.debug("Hugging Face forecast LLM response missing text content");
        return null;
      }

      return this.parseResponse(content);
    } catch (error) {
      this.logger.debug(
        `Hugging Face forecast LLM unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private systemPrompt() {
    return [
      "You are a restaurant management assistant analyzing a deterministic daily demand forecast.",
      "Your task is to write a short, manager-friendly narrative summary (max 2-3 sentences).",
      "Do NOT invent new numbers, prices, or items. Use ONLY the data provided.",
      "Do NOT change the provided expected orders or expected revenue.",
      "If there is a weather or event adjustment factor other than 1, mention its impact.",
      'Return only JSON with this exact shape: {"summary":"string"}.',
    ].join(" ");
  }

  private parseResponse(content: string): string | null {
    try {
      const parsed = JSON.parse(this.extractJson(content)) as unknown;
      const summary = validateDemandForecastLlmSummaryPayload(parsed);
      if (!summary) {
        this.logger.debug("Hugging Face forecast LLM JSON failed schema validation");
        return null;
      }
      return summary;
    } catch (error) {
      this.logger.debug(
        `Hugging Face forecast LLM returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private extractJson(content: string) {
    return extractJsonObjectText(content);
  }
}
