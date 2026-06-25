/**
 * Production deployment rehearsal / preflight.
 *
 * Usage:
 *   node scripts/production-rehearsal.mjs
 *   node scripts/production-rehearsal.mjs https://your-domain.com
 *
 * Environment:
 *   ENV_FILE=.env.production
 *   CHECK_MONITORING=1
 *   CHECK_TWILIO=1
 *   REQUIRE_TLS_FILES=1
 *   SKIP_TLS_FILES=1
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const envFile = resolve(repoRoot, process.env.ENV_FILE ?? ".env.production");
const httpsBase = (process.argv[2] ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
const checkMonitoring = process.env.CHECK_MONITORING !== "0";
const checkTwilio = process.env.CHECK_TWILIO !== "0";
const requireTlsFiles = process.env.SKIP_TLS_FILES === "1"
  ? false
  : process.env.REQUIRE_TLS_FILES === "1" || Boolean(httpsBase);
const tlsCertPath = resolve(repoRoot, "nginx/ssl/cert.pem");
const tlsKeyPath = resolve(repoRoot, "nginx/ssl/key.pem");

const failures = [];
let warnings = 0;

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings++;
  console.warn(`WARN: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
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
  return /^(YOUR_|REPLACE_WITH_|sk_test_|whsec_)/.test(value);
}

function parseOrigin(origin, fieldName) {
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) {
      fail(`${fieldName} must be an origin without path/query/hash: ${origin}`);
      return null;
    }
    return parsed;
  } catch {
    fail(`${fieldName} is not a valid URL origin: ${origin}`);
    return null;
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || `exit ${result.status}`;
    fail(`${command} ${args.join(" ")} failed: ${detail}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || `exit ${result.status}`;
    fail(`${command} ${args.join(" ")} failed: ${detail}`);
    return "";
  }
  return result.stdout;
}

function validateEnv(values) {
  const requiredSecrets = [
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "JWT_SECRET",
    "PAYMENT_WEBHOOK_SECRET",
    "MINIO_ROOT_PASSWORD",
    "GRAFANA_PASSWORD",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
  ];

  for (const key of requiredSecrets) {
    const value = values.get(key);
    assert(!isPlaceholder(value), `${key} is missing or still uses a placeholder value`);
  }

  assert(values.get("SMS_PROVIDER") === "twilio", "SMS_PROVIDER must be twilio for production rehearsal");
  assert(values.get("COOKIE_SECURE") === "true", "COOKIE_SECURE must be true");
  assert(values.get("COOKIE_SAME_SITE") === "lax", "COOKIE_SAME_SITE should stay lax unless you have a specific cross-site requirement");

  const frontendOrigin = values.get("FRONTEND_ORIGIN");
  const corsOrigins = values.get("CORS_ORIGINS");
  const fromNumber = values.get("TWILIO_FROM_NUMBER");
  const jwtSecret = values.get("JWT_SECRET") ?? "";

  assert(!isUnset(frontendOrigin), "FRONTEND_ORIGIN is required");
  assert(!isUnset(corsOrigins), "CORS_ORIGINS is required");
  assert(!isPlaceholder(fromNumber), "TWILIO_FROM_NUMBER is missing or still uses a placeholder value");
  assert(jwtSecret.length >= 32, "JWT_SECRET must be at least 32 characters");

  const frontend = frontendOrigin ? parseOrigin(frontendOrigin, "FRONTEND_ORIGIN") : null;
  if (frontend && frontend.protocol !== "https:") {
    fail(`FRONTEND_ORIGIN must use https in production: ${frontendOrigin}`);
  }

  const corsList = (corsOrigins ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  assert(corsList.length > 0, "CORS_ORIGINS must contain at least one origin");
  for (const origin of corsList) {
    const parsed = parseOrigin(origin, "CORS_ORIGINS");
    if (parsed && parsed.protocol !== "https:") {
      fail(`CORS_ORIGINS must use https in production: ${origin}`);
    }
  }

  if (frontend && corsList.length > 0 && !corsList.includes(frontend.origin)) {
    warn(`FRONTEND_ORIGIN (${frontend.origin}) is not included in CORS_ORIGINS`);
  }
}

try {
  assert(existsSync(envFile), `Missing env file: ${envFile}`);
  if (!existsSync(envFile)) {
    throw new Error("env file missing");
  }

  const envValues = readEnvFile(envFile);
  run("node", [
    "scripts/validate-production-env.mjs",
    "--env-file",
    envFile,
    ...(process.env.ALLOW_MOCK_PAYMENT_PROVIDER === "1" ? ["--allow-mock"] : []),
  ]);
  validateEnv(envValues);

  run("docker", ["compose", "-f", "docker-compose.prod.yml", "--env-file", envFile, "config", "--quiet"]);
  if (checkMonitoring) {
    const monitoringConfig = capture("docker", [
      "compose",
      "-f",
      "docker-compose.prod.yml",
      "-f",
      "docker-compose.monitoring.yml",
      "--env-file",
      envFile,
      "config",
    ]);
    const prometheusPrivate = /host_ip:\s*127\.0\.0\.1[\s\S]{0,200}published:\s*"9090"/.test(monitoringConfig);
    const grafanaPrivate = /host_ip:\s*127\.0\.0\.1[\s\S]{0,200}published:\s*"3001"/.test(monitoringConfig);
    if (!prometheusPrivate) {
      fail("Monitoring overlay exposes Prometheus beyond localhost; keep 9090 bound to 127.0.0.1");
    }
    if (!grafanaPrivate) {
      fail("Monitoring overlay exposes Grafana beyond localhost; keep 3001 bound to 127.0.0.1");
    }
  }

  if (checkTwilio && envValues.get("SMS_PROVIDER") === "twilio") {
    run("node", ["scripts/verify-twilio-config.mjs", "--env-file", envFile]);
  }

  if (requireTlsFiles) {
    assert(existsSync(tlsCertPath), `Missing TLS certificate file: ${tlsCertPath}`);
    assert(existsSync(tlsKeyPath), `Missing TLS private key file: ${tlsKeyPath}`);
  }

  if (httpsBase) {
    run("node", ["scripts/production-smoke.mjs", httpsBase]);
  } else {
    warn("No HTTPS base URL supplied; skipped live edge smoke checks");
  }

  if (failures.length > 0) {
    throw new Error("production rehearsal failed");
  }

  console.log(`Production rehearsal passed${httpsBase ? ` for ${httpsBase}` : ""}${warnings ? ` with ${warnings} warning(s)` : ""}`);
} catch (error) {
  if (failures.length > 0) {
    console.error("Production rehearsal failed:");
    for (const message of failures) {
      console.error(`- ${message}`);
    }
  } else {
    console.error("Production rehearsal failed:");
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
