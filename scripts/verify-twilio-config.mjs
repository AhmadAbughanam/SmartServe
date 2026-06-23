/**
 * Validate Twilio production SMS configuration.
 *
 * Usage:
 *   node scripts/verify-twilio-config.mjs
 *   node scripts/verify-twilio-config.mjs --env-file .env.production
 *   node scripts/verify-twilio-config.mjs --env-file .env.production --skip-live
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readArgs(argv) {
  let envFile = ".env.production";
  let skipLive = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env-file") {
      envFile = argv[i + 1] ?? envFile;
      i += 1;
      continue;
    }
    if (arg === "--skip-live") {
      skipLive = true;
    }
  }

  return {
    envFile: resolve(repoRoot, envFile),
    skipLive,
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
  return /^(REPLACE_WITH_|YOUR_|example|changeme)/i.test(value);
}

function mask(value, keep = 4) {
  if (!value) return "(missing)";
  if (value.length <= keep) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(0, value.length - keep))}${value.slice(-keep)}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateValues(values) {
  const smsProvider = values.get("SMS_PROVIDER");
  const sid = values.get("TWILIO_ACCOUNT_SID");
  const token = values.get("TWILIO_AUTH_TOKEN");
  const fromNumber = values.get("TWILIO_FROM_NUMBER");

  assert(smsProvider === "twilio", `SMS_PROVIDER must be twilio, got ${smsProvider ?? "(missing)"}`);
  assert(!isPlaceholder(sid), "TWILIO_ACCOUNT_SID is missing or placeholder");
  assert(!isPlaceholder(token), "TWILIO_AUTH_TOKEN is missing or placeholder");
  assert(!isPlaceholder(fromNumber), "TWILIO_FROM_NUMBER is missing or placeholder");
  assert(/^AC[0-9a-fA-F]{32}$/.test(sid), "TWILIO_ACCOUNT_SID must look like a Twilio Account SID (AC...)");
  assert(/^\+[1-9]\d{7,14}$/.test(fromNumber), "TWILIO_FROM_NUMBER must be an E.164 phone number, for example +15555550123");

  return {
    sid,
    token,
    fromNumber,
  };
}

async function runLiveCheck({ sid, token }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail =
      typeof body === "object" && body && "message" in body && typeof body.message === "string"
        ? body.message
        : `status ${response.status}`;
    throw new Error(`Twilio live validation failed: ${detail}`);
  }

  return body;
}

try {
  const { envFile, skipLive } = readArgs(process.argv.slice(2));
  assert(existsSync(envFile), `Missing env file: ${envFile}`);

  const values = readEnvFile(envFile);
  const { sid, token, fromNumber } = validateValues(values);

  console.log(`Twilio config syntax OK for ${envFile}`);
  console.log(`- Account SID: ${mask(sid, 6)}`);
  console.log(`- From number: ${mask(fromNumber, 4)}`);

  if (skipLive) {
    console.log("Skipped live Twilio API validation");
    process.exit(0);
  }

  const account = await runLiveCheck({ sid, token });
  console.log("Twilio live validation passed");
  if (typeof account === "object" && account) {
    const status = typeof account.status === "string" ? account.status : "unknown";
    const friendlyName = typeof account.friendly_name === "string" ? account.friendly_name : "unknown";
    console.log(`- Account status: ${status}`);
    console.log(`- Account name: ${friendlyName}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
