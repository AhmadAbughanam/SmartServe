import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { RecommendationInteractionType } from "@prisma/client";

export class RecommendationTelemetryDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsEnum(RecommendationInteractionType)
  interactionType!: RecommendationInteractionType;

  @IsString()
  @IsOptional()
  surface?: string;

  @IsString()
  @IsOptional()
  traceId?: string;
}
