import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  tableCode!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsString()
  @IsOptional()
  zone?: string;
}
