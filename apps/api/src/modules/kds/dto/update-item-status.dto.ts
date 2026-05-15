import { IsEnum } from "class-validator";
import { KitchenItemStatus } from "@prisma/client";

export class UpdateItemStatusDto {
  @IsEnum(KitchenItemStatus)
  status!: KitchenItemStatus;
}
