import crypto from "node:crypto";
import bcrypt from "bcrypt";

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;

/** Generate a numeric OTP string. */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(OTP_LENGTH, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

export async function verifyOtp(
  otp: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
