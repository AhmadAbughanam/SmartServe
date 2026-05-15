/**
 * Smoke test script for the Smart Restaurant OS API.
 *
 * Usage: node scripts/smoke-test.mjs [base_url]
 * Default base URL: http://localhost:4000
 *
 * Prerequisites: API must be running with seeded data.
 */

const BASE = process.argv[2] ?? "http://localhost:4000";
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? "Assertion failed");
}

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nSmoke testing ${BASE}/api ...\n`);

  // ── Health ──
  await test("GET /api/health returns ok", async () => {
    const { status, data } = await api("GET", "/api/health");
    assert(status === 200, `HTTP ${status}`);
    assert(data.service === "api");
    assert(data.dependencies.database === "ok", `DB: ${data.dependencies.database}`);
    console.log(`    status=${data.status} db=${data.dependencies.database} redis=${data.dependencies.redis}`);
  });

  // ── Staff Auth ──
  let ownerToken;
  await test("POST /api/auth/staff/login succeeds for owner", async () => {
    const { status, data } = await api("POST", "/api/auth/staff/login", {
      email: "owner@demo.com", password: "password123",
    });
    assert(status === 200, `HTTP ${status}`);
    assert(data.accessToken, "No token");
    assert(data.staff.primaryRole === "OWNER");
    ownerToken = data.accessToken;
  });

  await test("POST /api/auth/staff/login fails with wrong password", async () => {
    const { status } = await api("POST", "/api/auth/staff/login", {
      email: "owner@demo.com", password: "wrong",
    });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── Protected route ──
  await test("GET /api/auth/me requires token", async () => {
    const { status } = await api("GET", "/api/auth/me");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("GET /api/auth/me works with token", async () => {
    const { status, data } = await api("GET", "/api/auth/me", null, ownerToken);
    assert(status === 200, `HTTP ${status}`);
    assert(data.staffId);
  });

  // ── Customer OTP ──
  await test("POST /api/auth/customer/otp/request works", async () => {
    const { status, data } = await api("POST", "/api/auth/customer/otp/request", {
      phone: "+15551234567",
    });
    assert(status === 200, `HTTP ${status}`);
    assert(data.message === "OTP sent");
  });

  // ── Menu ──
  await test("GET /api/menu returns categories", async () => {
    const { status, data } = await api("GET", "/api/menu?branchId=seed-branch-1");
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data) && data.length > 0, "No categories");
  });

  // ── Session + Order ──
  let sessionId, orderId, tableCode = "T5";
  await test("Find an available seeded table for customer session", async () => {
    const { status, data } = await api("GET", "/api/branches/seed-branch-1/tables", null, ownerToken);
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), "Tables response was not an array");
    const table = data.find((t) => t.status === "AVAILABLE" || t.status === "RESERVED");
    assert(table, "No seeded table is available; clear a table or reseed before running smoke");
    tableCode = table.tableCode;
  });

  await test("POST /api/sessions/start creates session", async () => {
    const { status, data } = await api("POST", "/api/sessions/start", {
      branchId: "seed-branch-1", tableCode, guestCount: 1,
    });
    assert(status === 201, `HTTP ${status}`);
    assert(data.id);
    sessionId = data.id;
  });

  await test("POST /api/sessions/:id/orders creates order", async () => {
    const { status, data } = await api("POST", `/api/sessions/${sessionId}/orders`, {
      items: [{ menuItemId: "seed-item-cola", quantity: 1 }],
      idempotencyKey: `smoke-${Date.now()}`,
    });
    assert(status === 201, `HTTP ${status}`);
    assert(data.totalAmount);
    orderId = data.id;
  });

  await test("GET /api/sessions/:sid/orders/:oid returns order", async () => {
    const { status, data } = await api("GET", `/api/sessions/${sessionId}/orders/${orderId}`);
    assert(status === 200, `HTTP ${status}`);
    assert(data.orderStatus === "PLACED");
  });

  // ── KDS ──
  let chefToken;
  await test("Chef can access KDS queue", async () => {
    const login = await api("POST", "/api/auth/staff/login", {
      email: "chef@demo.com", password: "password123",
    });
    chefToken = login.data.accessToken;
    const { status, data } = await api("GET", "/api/kds/orders?branchId=seed-branch-1", null, chefToken);
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data));
  });

  // ── Service Request ──
  await test("POST /api/sessions/:id/service-requests works", async () => {
    const { status, data } = await api("POST", `/api/sessions/${sessionId}/service-requests`, {
      type: "WATER",
    });
    assert(status === 201, `HTTP ${status}`);
    assert(data.type === "WATER");
  });

  // ── Analytics ──
  await test("GET /api/analytics/dashboard requires auth", async () => {
    const { status } = await api("GET", "/api/analytics/dashboard?branchId=seed-branch-1");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("GET /api/analytics/dashboard works for owner", async () => {
    const { status, data } = await api("GET", "/api/analytics/dashboard?branchId=seed-branch-1", null, ownerToken);
    assert(status === 200, `HTTP ${status}`);
    assert(data.totalOrders !== undefined);
  });

  // ── AI ──
  await test("GET /api/ai/recommendations returns items", async () => {
    const { status, data } = await api("GET", "/api/ai/recommendations?branchId=seed-branch-1&limit=3");
    assert(status === 200, `HTTP ${status}`);
    assert(data.recommendations);
  });

  // ── Summary ──
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e.message);
  process.exit(1);
});
