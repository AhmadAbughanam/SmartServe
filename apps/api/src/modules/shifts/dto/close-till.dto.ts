import { IsNumber, Min } from "class-validator";

export class CloseTillDto {
  @IsNumber()
  @Min(0)
  actualCash!: number;
}
