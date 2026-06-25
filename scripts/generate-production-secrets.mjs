/**
 * Generate production-safe secret values for .env.production.
 *
 * Usage:
 *   node scripts/generate-production-secrets.mjs
 *   node scripts/generate-production-secrets.mjs --format=env
 */

import { randomBytes } from "node:crypto";

const format = process.argv.find((arg) => arg.startsWith("--format="))?.slice("--format=".length) ?? "table";

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function base64url(bytes) {
  return randomBytes(bytes).toString("base64url");
}

function password(length = 32) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^&*_-+=";
  const bytes = randomBytes(length);
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[bytes[i] % alphabet.length];
  }
  return value;
}

const secrets = {
  POSTGRES_PASSWORD: password(24),
  JWT_SECRET: hex(64),
  PAYMENT_WEBHOOK_SECRET: base64url(32),
  MINIO_ROOT_PASSWORD: password(24),
  GRAFANA_PASSWORD: password(24),
};

if (format === "env") {
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`${key}=${value}`);
  }
  process.exit(0);
}

if (format !== "table") {
  console.error(`Unsupported format: ${format}`);
  process.exit(1);
}

console.log("Generated production secrets:");
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log("");
console.log("Notes:");
console.log("- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER come from Twilio.");
console.log("- FRONTEND_ORIGIN and CORS_ORIGINS should be your final https:// domain.");
console.log("- If you enable Stripe, use the real provider secrets instead of generated placeholders.");
