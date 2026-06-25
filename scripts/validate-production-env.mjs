/**
 * Strict production environment validation for VPS rehearsals.
 *
 * Usage:
 *   node scripts/validate-production-env.mjs
 *   node scripts/validate-production-env.mjs --env-file .env.production
 *   node scripts/validate-production-env.mjs --allow-mock
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readArgs(argv) {
  let envFile = ".env.production";
  let allowMock = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env-file") {
      envFile = argv[i + 1] ?? envFile;
      i += 1;
      continue;
    }
    if (arg === "--allow-mock") {
      allowMock = true;
    }
  }

  return {
    envFile: resolve(repoRoot, envFile),
    allowMock,
  };
}

function readEnvFile(filePath) {
  const values = new Map();
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    values.set(key, value);
  }
  return values;
}

function isUnset(value) {
  return !value || value === '""' || value === "''";
}

function isPlaceholder(value) {
  if (isUnset(value)) return true;
  return /^(REPLACE_WITH_|YOUR_|example|changeme|ops@your-domain\.com|your-domain\.com$)/i.test(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoRawDollar(key, value) {
  if (isUnset(value)) return;
  if (/(^|[^$])\$(?!\$)/.test(value)) {
    throw new Error(`${key} contains raw $ characters; escape them as $$ for Docker Compose env files`);
  }
}

function parseHttpsOrigin(origin, fieldName) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`${fieldName} must be a valid HTTPS origin`);
  }
  if (parsed.origin !== origin) {
    throw new Error(`${fieldName} must be an origin without path, query, or hash`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${fieldName} must use https`);
  }
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost")) {
    throw new Error(`${fieldName} must not use localhost in VPS rehearsal mode`);
  }
  return parsed;
}

function assertDomain(value, fieldName) {
  assert(!isPlaceholder(value), `${fieldName} is missing or still uses a placeholder value`);
  assert(/^(?!localhost$)(?!.*:\/\/)([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/.test(value), `${fieldName} must be a bare public domain such as your-domain.com`);
}

function assertEmail(value, fieldName) {
  assert(!isPlaceholder(value), `${fieldName} is missing or still uses a placeholder value`);
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), `${fieldName} must be a valid email address`);
}

function validateTwilio(values) {
  const sid = values.get("TWILIO_ACCOUNT_SID");
  const token = values.get("TWILIO_AUTH_TOKEN");
  const fromNumber = values.get("TWILIO_FROM_NUMBER");

  assert(!isPlaceholder(sid), "TWILIO_ACCOUNT_SID is missing or placeholder");
  assert(!/^ACLOCALREHEARSAL/i.test(sid ?? ""), "TWILIO_ACCOUNT_SID still uses a local rehearsal value");
  assert(/^AC[0-9a-fA-F]{32}$/.test(sid ?? ""), "TWILIO_ACCOUNT_SID must look like a Twilio Account SID (AC...)");

  assert(!isPlaceholder(token), "TWILIO_AUTH_TOKEN is missing or placeholder");
  assert(!/local_rehearsal/i.test(token ?? ""), "TWILIO_AUTH_TOKEN still uses a local rehearsal value");

  assert(!isPlaceholder(fromNumber), "TWILIO_FROM_NUMBER is missing or placeholder");
  assert(!/^\+1555555/.test(fromNumber ?? ""), "TWILIO_FROM_NUMBER still uses a local rehearsal value");
  assert(/^\+[1-9]\d{7,14}$/.test(fromNumber ?? ""), "TWILIO_FROM_NUMBER must be an E.164 phone number");
}

function validate(values, { allowMock }) {
  for (const [key, value] of values.entries()) {
    assertNoRawDollar(key, value);
  }

  const frontendOrigin = values.get("FRONTEND_ORIGIN");
  const corsOriginsRaw = values.get("CORS_ORIGINS");
  const paymentProvider = values.get("PAYMENT_PROVIDER") ?? "mock";
  const smsProvider = values.get("SMS_PROVIDER");
  const deployDomain = values.get("DEPLOY_DOMAIN");
  const letsEncryptEmail = values.get("LETSENCRYPT_EMAIL");

  assertDomain(deployDomain, "DEPLOY_DOMAIN");
  assertEmail(letsEncryptEmail, "LETSENCRYPT_EMAIL");

  assert(!isUnset(frontendOrigin), "FRONTEND_ORIGIN is required");
  assert(!isUnset(corsOriginsRaw), "CORS_ORIGINS is required");
  const frontend = parseHttpsOrigin(frontendOrigin, "FRONTEND_ORIGIN");
  assert(frontend.hostname === deployDomain, "FRONTEND_ORIGIN hostname must match DEPLOY_DOMAIN");

  const corsOrigins = corsOriginsRaw.split(",").map((value) => value.trim()).filter(Boolean);
  assert(corsOrigins.length > 0, "CORS_ORIGINS must contain at least one origin");
  for (const origin of corsOrigins) {
    const parsed = parseHttpsOrigin(origin, "CORS_ORIGINS");
    assert(parsed.hostname === deployDomain, "Each CORS_ORIGINS entry must match DEPLOY_DOMAIN for the default single-domain VPS layout");
  }

  assert(smsProvider === "twilio", "SMS_PROVIDER must be twilio for VPS rehearsal");
  validateTwilio(values);

  assert(paymentProvider === "mock" || paymentProvider === "stripe", "PAYMENT_PROVIDER must be mock or stripe");
  if (paymentProvider === "mock" && !allowMock) {
    throw new Error("PAYMENT_PROVIDER=mock is not allowed for a real VPS rehearsal unless --allow-mock is passed explicitly");
  }
  if (paymentProvider === "stripe") {
    assert(!isPlaceholder(values.get("STRIPE_SECRET_KEY")), "STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe");
    assert(!isPlaceholder(values.get("STRIPE_WEBHOOK_SECRET")), "STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe");
  }
}

try {
  const { envFile, allowMock } = readArgs(process.argv.slice(2));
  assert(existsSync(envFile), `Missing env file: ${envFile}`);
  const values = readEnvFile(envFile);
  validate(values, { allowMock });
  console.log(`Production env validation passed for ${envFile}${allowMock ? " (mock payments explicitly allowed)" : ""}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
