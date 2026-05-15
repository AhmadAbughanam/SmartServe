/**
 * Lightweight deployment health check.
 *
 * Usage:
 *   node scripts/health-check.mjs [base_url]
 *
 * Default base URL: http://localhost:4000
 * Checks only /api/health and does not require seeded demo data.
 */

const baseUrl = process.argv[2] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
const healthUrl = `${baseUrl.replace(/\/$/, "")}/api/health`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const response = await fetch(healthUrl);
  const body = await response.json();

  assert(response.ok, `Expected HTTP 2xx, got ${response.status}`);
  assert(body.service === "api", "Health response did not identify the API service");
  assert(body.timestamp, "Health response is missing timestamp");
  assert(body.dependencies?.database === "ok", `Database health is ${body.dependencies?.database ?? "missing"}`);

  console.log(`Health check passed: status=${body.status} env=${body.environment ?? "unknown"} db=${body.dependencies.database}`);
} catch (error) {
  console.error(`Health check failed for ${healthUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
