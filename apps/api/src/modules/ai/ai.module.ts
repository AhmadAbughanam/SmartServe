import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { MenuChatDiagnosticsController } from "./menu-chat-diagnostics.controller.js";
import { MenuChatLlmService } from "./menu-chat-llm.service.js";
import { RecommendationService } from "./recommendation.service.js";
import { MenuChatbotService } from "./menu-chatbot.service.js";

@Module({
  controllers: [AiController, MenuChatDiagnosticsController],
  providers: [RecommendationService, MenuChatbotService, MenuChatLlmService],
  exports: [RecommendationService, MenuChatbotService, MenuChatLlmService],
})
export class AiModule {}
