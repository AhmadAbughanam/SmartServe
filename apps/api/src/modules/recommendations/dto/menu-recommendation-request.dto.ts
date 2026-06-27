import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { MenuRecommendationRequest } from "@smart-restaurant/shared-types";

class CartItemDto {
  @IsString()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class MenuRecommendationRequestDto
  implements MenuRecommendationRequest
{
  private static readonly surfaces = [
    "menu_home",
    "cart",
    "item_detail",
    "checkout",
  ] as const;

  private static readonly triggers = [
    "empty_cart",
    "cart_aware",
    "no_history_fallback",
  ] as const;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cartItems!: CartItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(MenuRecommendationRequestDto.surfaces)
  surface?: MenuRecommendationRequest["surface"];

  @IsOptional()
  @IsString()
  @IsIn(MenuRecommendationRequestDto.triggers)
  trigger?: MenuRecommendationRequest["trigger"];
}
