import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod, SplitType } from "@prisma/client";

export class PaymentSplitDto {
  @IsEnum(SplitType)
  splitType!: SplitType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  participantId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  paymentReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  splits?: PaymentSplitDto[];
}
