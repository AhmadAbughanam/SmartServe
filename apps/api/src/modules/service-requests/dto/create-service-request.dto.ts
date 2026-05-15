import { IsEnum } from "class-validator";
import { ServiceRequestType } from "@prisma/client";

export class CreateServiceRequestDto {
  @IsEnum(ServiceRequestType)
  type!: ServiceRequestType;
}
