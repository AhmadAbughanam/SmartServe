/**
 * Production edge smoke test.
 *
 * Usage:
 *   node scripts/production-smoke.mjs https://your-domain
 *
 * Optional HTTP redirect source:
 *   HTTP_BASE_URL=http://your-domain node scripts/production-smoke.mjs https://your-domain
 */

const httpsBase = (process.argv[2] ?? process.env.PUBLIC_BASE_URL ?? "https://localhost").replace(/\/$/, "");
const httpBase = (process.env.HTTP_BASE_URL ?? httpsBase.replace(/^https:/, "http:")).replace(/\/$/, "");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { response, text };
}

try {
  const redirect = await fetch(`${httpBase}/nginx-health`, { method: "GET", redirect: "manual" });
  assert([301, 302, 308].includes(redirect.status), `Expected HTTP redirect, got ${redirect.status}`);
  assert(
    redirect.headers.get("location")?.startsWith(httpsBase),
    `Redirect location was ${redirect.headers.get("location") ?? "missing"}`,
  );

  const frontend = await fetch(`${httpsBase}/`, { method: "GET" });
  assert(frontend.ok, `Frontend returned ${frontend.status}`);
  assert(
    frontend.headers.get("strict-transport-security"),
    "Missing Strict-Transport-Security header",
  );
  assert(
    frontend.headers.get("content-security-policy"),
    "Missing Content-Security-Policy header",
  );

  const { response: healthResponse, text: healthText } = await fetchText(`${httpsBase}/api/health`);
  const health = JSON.parse(healthText);
  assert(healthResponse.ok, `Health returned ${healthResponse.status}`);
  assert(health.service === "api", "Health response did not identify API service");
  assert(health.dependencies?.database === "ok", `Database health is ${health.dependencies?.database ?? "missing"}`);
  assert(healthResponse.headers.get("x-request-id"), "API health response is missing X-Request-ID");

  const csrf = await fetch(`${httpsBase}/api/auth/csrf`, { credentials: "include" });
  const csrfBody = await csrf.json();
  assert(csrf.ok, `CSRF endpoint returned ${csrf.status}`);
  assert(typeof csrfBody.csrfToken === "string" && csrfBody.csrfToken.includes("."), "CSRF token missing or malformed");
  assert(csrf.headers.get("set-cookie")?.includes("sro_csrf="), "CSRF cookie was not set");

  const { response: otpResponse, text: otpText } = await fetchText(`${httpsBase}/api/auth/customer/otp/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "invalid-phone" }),
  });
  assert(otpResponse.status === 400, `Expected invalid OTP request to return 400, got ${otpResponse.status}`);
  assert(otpText.toLowerCase().includes("phone"), "Invalid OTP request did not mention phone validation");

  const { response: sseResponse, text: sseText } = await fetchText(
    `${httpsBase}/api/realtime/branches/smoke-branch/events`,
    {
      headers: { accept: "text/event-stream" },
    },
  );
  assert(sseResponse.status === 401, `Expected unauthenticated branch SSE to return 401, got ${sseResponse.status}`);
  assert(
    sseText.toLowerCase().includes("authentication required") ||
      sseText.toLowerCase().includes("unauthorized"),
    "Unauthenticated branch SSE did not return an auth error",
  );

  console.log(`Production smoke passed: ${httpsBase}`);
} catch (error) {
  console.error(`Production smoke failed for ${httpsBase}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
