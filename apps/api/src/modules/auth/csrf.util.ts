import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

const CSRF_TOKEN_BYTES = 32;

function sign(value: string): string {
  return createHmac("sha256", env.jwtSecret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function createCsrfToken(): string {
  const nonce = randomBytes(CSRF_TOKEN_BYTES).toString("hex");
  return `${nonce}.${sign(nonce)}`;
}

export function verifyCsrfToken(token: string | undefined): boolean {
  if (!token) return false;
  const [nonce, signature, extra] = token.split(".");
  if (!nonce || !signature || extra) return false;
  if (!/^[a-f0-9]{64}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  return safeEqual(signature, sign(nonce));
}
