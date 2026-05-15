import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateLoyaltyProgramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerCurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsPerReward?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointExpiryMonths?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLoyaltyRewardDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  pointsCost!: number;

  @IsNumber()
  @Min(0.01)
  rewardValue!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLoyaltyRewardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  rewardValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ManualLoyaltyAdjustmentDto {
  @IsInt()
  points!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
