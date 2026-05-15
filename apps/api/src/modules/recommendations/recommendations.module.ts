import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { RecommendationsController } from "./recommendations.controller.js";

@Module({
  imports: [AiModule],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}
