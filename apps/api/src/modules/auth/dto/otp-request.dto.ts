import { IsString, Matches } from "class-validator";

export class OtpRequestDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: "phone must be a valid E.164-style number",
  })
  phone!: string;
}
