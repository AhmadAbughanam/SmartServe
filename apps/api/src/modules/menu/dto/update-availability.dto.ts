import { IsBoolean } from "class-validator";

export class UpdateAvailabilityDto {
  @IsBoolean()
  isUnavailable!: boolean;
}
