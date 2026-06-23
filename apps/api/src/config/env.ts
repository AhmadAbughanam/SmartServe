import { config as loadEnv } from "dotenv";

loadEnv();
loadEnv({ path: "apps/api/.env", override: false });

const required = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const isDev = (process.env.NODE_ENV ?? "development") === "development";
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

function requireUrl(key: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${key}`);
  }
  return value;
}

function optionalUrl(key: string, value: string | undefined, fallback: string) {
  const resolved = value ?? fallback;
  try {
    new URL(resolved);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${key}`);
  }
  return resolved;
}

export function assertProductionPublicUrl(key: string, value: string) {
  if (value === "*" || value.toLowerCase() === "null") {
    throw new Error(`${key} must be an explicit https:// origin in production`);
  }
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${key} must be an origin only, without path, query, or hash`);
  }
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !isLocalhost) {
    throw new Error(`${key} must use https:// in production`);
  }
}

function requireOneOf<T extends string>(key: string, value: string | undefined, allowed: readonly T[], fallback: T): T {
  const resolved = (value ?? fallback) as T;
  if (!allowed.includes(resolved)) {
    throw new Error(`Invalid ${key}: ${resolved}. Expected one of: ${allowed.join(", ")}`);
  }
  return resolved;
}

function requirePort(key: string, value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`Invalid port in environment variable: ${key}`);
  }
  return parsed;
}

function requireBoolean(key: string, value: string | undefined, fallback: boolean) {
  const resolved = value ?? String(fallback);
  if (resolved !== "true" && resolved !== "false") {
    throw new Error(`Invalid boolean in environment variable: ${key}`);
  }
  return resolved === "true";
}

function requirePositiveInt(key: string, value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid positive integer in environment variable: ${key}`);
  }
  return parsed;
}

function assertProductionSecret(key: string, value: string | undefined, forbidden: string[] = []) {
  if (!isProd) return;
  if (!value || value.trim().length < 16) {
    throw new Error(`${key} must be set to a strong non-placeholder value in production`);
  }
  const normalized = value.toLowerCase();
  if (
    forbidden.some((forbiddenValue) => normalized === forbiddenValue.toLowerCase()) ||
    normalized.includes("replace_with") ||
    normalized.includes("your_strong") ||
    normalized.includes("dev-") ||
    normalized.includes("example")
  ) {
    throw new Error(`${key} must not use a placeholder or development value in production`);
  }
}

function assertPattern(key: string, value: string | undefined, pattern: RegExp, message: string) {
  if (!value || !pattern.test(value)) {
    throw new Error(`${key} ${message}`);
  }
}

const databaseUrl = requireUrl("DATABASE_URL", process.env.DATABASE_URL);
const redisUrl = requireUrl("REDIS_URL", process.env.REDIS_URL);
const aiServiceUrl = optionalUrl("AI_SERVICE_URL", process.env.AI_SERVICE_URL, "http://localhost:8000");
const hfBaseUrl = optionalUrl("HF_BASE_URL", process.env.HF_BASE_URL, "https://router.huggingface.co/v1");
const s3Endpoint = optionalUrl("S3_ENDPOINT", process.env.S3_ENDPOINT, "http://localhost:9000");
const frontendOrigin = optionalUrl("FRONTEND_ORIGIN", process.env.FRONTEND_ORIGIN, "http://localhost:3000");
const paymentProvider = requireOneOf("PAYMENT_PROVIDER", process.env.PAYMENT_PROVIDER, ["mock", "stripe"] as const, "mock");
const cookieSameSite = requireOneOf("COOKIE_SAME_SITE", process.env.COOKIE_SAME_SITE, ["lax", "strict", "none"] as const, "lax");
const smsProvider = requireOneOf("SMS_PROVIDER", process.env.SMS_PROVIDER, ["noop", "twilio"] as const, isDev ? "noop" : "twilio");
const s3Region = process.env.S3_REGION ?? "us-east-1";
const s3ForcePathStyle = requireBoolean("S3_FORCE_PATH_STYLE", process.env.S3_FORCE_PATH_STYLE, true);
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID ?? process.env.MINIO_ROOT_USER ?? (isDev ? "minioadmin" : undefined);
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? (isDev ? "minioadmin" : undefined);

if (isProd && process.env.JWT_SECRET!.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

if (isProd) {
  assertProductionSecret("JWT_SECRET", process.env.JWT_SECRET, ["secret", "changeme"]);
  assertProductionSecret("PAYMENT_WEBHOOK_SECRET", process.env.PAYMENT_WEBHOOK_SECRET, ["dev-webhook-secret"]);
  if (databaseUrl.includes("YOUR_STRONG_PASSWORD") || databaseUrl.includes("REPLACE_WITH")) {
    throw new Error("DATABASE_URL must not contain placeholder credentials in production");
  }
  if (!s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (or MINIO_ROOT_USER and MINIO_ROOT_PASSWORD) are required in production");
  }
  assertProductionSecret("MINIO_ROOT_PASSWORD", process.env.MINIO_ROOT_PASSWORD, ["minioadmin"]);
}

if (paymentProvider === "stripe") {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe");
  }
}

if (smsProvider === "twilio") {
  assertProductionSecret("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID);
  assertProductionSecret("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN);
  if (!process.env.TWILIO_FROM_NUMBER) {
    throw new Error("TWILIO_FROM_NUMBER is required when SMS_PROVIDER=twilio");
  }
  assertPattern("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID, /^AC[0-9a-fA-F]{32}$/, "must look like a Twilio Account SID (AC...)");
  assertPattern("TWILIO_FROM_NUMBER", process.env.TWILIO_FROM_NUMBER, /^\+[1-9]\d{7,14}$/, "must be an E.164 phone number such as +15555550123");
}

if (isProd && smsProvider === "noop") {
  throw new Error("SMS_PROVIDER=noop is not allowed in production");
}

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : isDev
    ? ["http://localhost:3000", "http://localhost:4000"]
    : [];

for (const origin of corsOrigins) {
  optionalUrl("CORS_ORIGINS", origin, origin);
}

if (isProd && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must be set in production");
}

if (isProd) {
  assertProductionPublicUrl("FRONTEND_ORIGIN", frontendOrigin);
  for (const origin of corsOrigins) {
    assertProductionPublicUrl("CORS_ORIGINS", origin);
  }

  if (process.env.COOKIE_SECURE === "false") {
    throw new Error("COOKIE_SECURE must not be false in production");
  }
}

export const env = {
  nodeEnv,
  isDev,
  isProd,
  port: requirePort("API_PORT", process.env.API_PORT, 4000),
  databaseUrl,
  redisUrl,
  jwtSecret: process.env.JWT_SECRET!,
  aiServiceUrl,
  hfToken: process.env.HF_TOKEN,
  hfModel: process.env.HF_MODEL ?? "meta-llama/Llama-3.1-8B-Instruct:fastest",
  hfBaseUrl,
  s3Endpoint,
  s3Bucket: process.env.S3_BUCKET ?? "smart-restaurant",
  s3Region,
  s3ForcePathStyle,
  s3AccessKeyId,
  s3SecretAccessKey,
  paymentProvider,
  smsProvider,
  buildVersion: process.env.BUILD_VERSION ?? process.env.npm_package_version ?? "unknown",
  commitSha: process.env.COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",

  // Security
  corsOrigins,
  frontendOrigin,
  cookieSecure: process.env.COOKIE_SECURE === "true" || !isDev,
  cookieSameSite,
  cookieDomain: process.env.COOKIE_DOMAIN,

  // SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  staffAccessTokenTtl: process.env.STAFF_ACCESS_TOKEN_TTL ?? "8h",
  staffAccessCookieMaxAgeMs: requirePositiveInt("STAFF_ACCESS_COOKIE_MAX_AGE_MS", process.env.STAFF_ACCESS_COOKIE_MAX_AGE_MS, 8 * 60 * 60 * 1000),

  // Geo-fencing
  geofencingEnabled: requireBoolean("GEOFENCING_ENABLED", process.env.GEOFENCING_ENABLED, true),
  geofencingDemoBypass: requireBoolean("GEOFENCING_DEMO_BYPASS", process.env.GEOFENCING_DEMO_BYPASS, false),
  geofencingDefaultRadiusM: requirePositiveInt("GEOFENCING_DEFAULT_RADIUS_M", process.env.GEOFENCING_DEFAULT_RADIUS_M, 100),
  geofencingMaxAccuracyM: requirePositiveInt("GEOFENCING_MAX_ACCURACY_M", process.env.GEOFENCING_MAX_ACCURACY_M, 1000),
};
