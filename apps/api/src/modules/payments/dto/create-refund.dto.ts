import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateRefundDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
