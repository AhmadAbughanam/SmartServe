import { IsEnum, IsOptional, IsString, MaxLength, IsUrl } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class CreatePaymentIntentDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  returnUrl?: string;
}
