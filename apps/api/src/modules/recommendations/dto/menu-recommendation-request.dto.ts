import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
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
}
