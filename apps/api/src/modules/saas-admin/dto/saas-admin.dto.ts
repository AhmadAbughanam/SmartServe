import {
  IsIn,
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MinLength,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { Prisma } from "@prisma/client";

export class CreateTenantOwnerDto {
  @IsString()
  tenantId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class CreateSaasTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}

export class UpdateSaasTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}

export class UpdateSaasTenantStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateSaasBranchDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  location!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateSaasBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  location?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateSaasBranchStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateBranchFeatureModulesDto {
  @IsOptional()
  @IsObject()
  featureFlagsJson?: Prisma.InputJsonObject;

  @IsOptional()
  @IsObject()
  aiConfigJson?: Prisma.InputJsonObject;
}

export class SetBranchActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class SaasAiBranchDetailQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number;
}

export class UpdateBranchAiControlsDto {
  @IsOptional()
  @IsBoolean()
  menuChatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  hostedLlmEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  fallbackOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  dailyHostedRequestLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  dailyRequestLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  sessionHourlyRequestLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(750)
  @Max(10000)
  hostedProviderTimeoutMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(120)
  @Max(700)
  maxResponseLength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxSuggestions?: number;

  @IsOptional()
  @IsString()
  @IsIn(["concise", "friendly", "formal"])
  assistantTone?: "concise" | "friendly" | "formal";

  @IsOptional()
  @IsString()
  @IsIn(["rules", "shadow", "ml"])
  recommendationsEngine?: "rules" | "shadow" | "ml";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(750)
  @Max(10000)
  recommendationsTimeoutMs?: number;

  @IsOptional()
  @IsBoolean()
  recommendationsFallbackEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  recommendationsConfidenceThreshold?: number;

  @IsOptional()
  @IsString()
  recommendationsModelFamily?: string;

  @IsOptional()
  @IsString()
  recommendationsModelVersionPin?: string;

  @IsOptional()
  @IsString()
  @IsIn(["rules", "shadow", "ml"])
  businessInsightsEngine?: "rules" | "shadow" | "ml";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(750)
  @Max(10000)
  businessInsightsTimeoutMs?: number;

  @IsOptional()
  @IsBoolean()
  businessInsightsFallbackEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  businessInsightsConfidenceThreshold?: number;

  @IsOptional()
  @IsString()
  businessInsightsModelFamily?: string;

  @IsOptional()
  @IsString()
  businessInsightsModelVersionPin?: string;

  @IsOptional()
  @IsString()
  @IsIn(["rules", "shadow", "ml"])
  reviewSentimentEngine?: "rules" | "shadow" | "ml";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(750)
  @Max(10000)
  reviewSentimentTimeoutMs?: number;

  @IsOptional()
  @IsBoolean()
  reviewSentimentFallbackEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  reviewSentimentConfidenceThreshold?: number;

  @IsOptional()
  @IsString()
  reviewSentimentModelFamily?: string;

  @IsOptional()
  @IsString()
  reviewSentimentModelVersionPin?: string;
}

export class SaasRevenueQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class SaasOperationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number;
}

export class SaasSessionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number;
}

export class SaasStaffQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  hours?: number;
}

export class UpdateSaasStaffStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class SaasSystemHealthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  hours?: number;
}

export class SaasAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class UpdateTenantSubscriptionDto {
  @IsString()
  @MinLength(2)
  planCode!: string;

  @IsString()
  @IsIn(["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED"])
  status!: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

  @IsOptional()
  @IsString()
  trialEndsAt?: string;

  @IsOptional()
  @IsString()
  billingPeriodStart?: string;

  @IsOptional()
  @IsString()
  billingPeriodEnd?: string;

  @IsOptional()
  @IsString()
  nextInvoiceAt?: string;

  @Type(() => Number)
  @Min(0)
  amount!: number;

  @IsString()
  @MinLength(3)
  currency!: string;
}

class PlatformAnnouncementDto {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsIn(["info", "warning", "success"])
  tone!: "info" | "warning" | "success";

  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  platformName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceModeEnabled?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @IsOptional()
  @IsBoolean()
  ownerProvisioningEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3650)
  auditRetentionDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(6)
  @Max(168)
  defaultSystemHealthWindowHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(120)
  defaultRevenueRangeDays?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformAnnouncementDto)
  announcements?: PlatformAnnouncementDto[];
}
