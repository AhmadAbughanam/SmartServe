import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { GiftCardStatus } from "@prisma/client";

export class CreateGiftCardDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0.01)
  initialAmount!: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateGiftCardDto {
  @IsOptional()
  @IsEnum(GiftCardStatus)
  status?: GiftCardStatus;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RedeemGiftCardDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}
