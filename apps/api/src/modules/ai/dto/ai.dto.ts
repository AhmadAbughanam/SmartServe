import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CartRecommendationDto {
  @IsString()
  branchId!: string;

  @IsArray()
  @IsString({ each: true })
  cartItemIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ChatbotQueryDto {
  @IsString()
  branchId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
