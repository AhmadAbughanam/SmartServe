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

const databaseUrl = requireUrl("DATABASE_URL", process.env.DATABASE_URL);
const redisUrl = requireUrl("REDIS_URL", process.env.REDIS_URL);
const aiServiceUrl = optionalUrl("AI_SERVICE_URL", process.env.AI_SERVICE_URL, "http://localhost:8000");
const hfBaseUrl = optionalUrl("HF_BASE_URL", process.env.HF_BASE_URL, "https://router.huggingface.co/v1");
const s3Endpoint = optionalUrl("S3_ENDPOINT", process.env.S3_ENDPOINT, "http://localhost:9000");
const frontendOrigin = optionalUrl("FRONTEND_ORIGIN", process.env.FRONTEND_ORIGIN, "http://localhost:3000");
const paymentProvider = requireOneOf("PAYMENT_PROVIDER", process.env.PAYMENT_PROVIDER, ["mock", "stripe"] as const, "mock");
const cookieSameSite = requireOneOf("COOKIE_SAME_SITE", process.env.COOKIE_SAME_SITE, ["lax", "strict", "none"] as const, "lax");

if (isProd && process.env.JWT_SECRET!.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

if (paymentProvider === "stripe") {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe");
  }
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
  paymentProvider,
  buildVersion: process.env.BUILD_VERSION ?? process.env.npm_package_version ?? "unknown",
  commitSha: process.env.COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",

  // Security
  corsOrigins,
  frontendOrigin,
  cookieSecure: process.env.COOKIE_SECURE === "true" || !isDev,
  cookieSameSite,
  cookieDomain: process.env.COOKIE_DOMAIN,

  // Geo-fencing
  geofencingEnabled: requireBoolean("GEOFENCING_ENABLED", process.env.GEOFENCING_ENABLED, true),
  geofencingDemoBypass: requireBoolean("GEOFENCING_DEMO_BYPASS", process.env.GEOFENCING_DEMO_BYPASS, false),
  geofencingDefaultRadiusM: requirePositiveInt("GEOFENCING_DEFAULT_RADIUS_M", process.env.GEOFENCING_DEFAULT_RADIUS_M, 100),
  geofencingMaxAccuracyM: requirePositiveInt("GEOFENCING_MAX_ACCURACY_M", process.env.GEOFENCING_MAX_ACCURACY_M, 1000),
};
