import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { MenuChatRequest } from "@smart-restaurant/shared-types";

class MenuChatCartItemDto {
  @IsString()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class MenuChatRequestDto implements MenuChatRequest {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuChatCartItemDto)
  cartItems?: MenuChatCartItemDto[];
}
