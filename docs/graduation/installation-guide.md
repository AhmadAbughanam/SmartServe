# Installation Guide

Concise setup guide for evaluators. Estimated time: 10-15 minutes.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker Desktop | Running | `docker ps` |
| Git | Any | `git --version` |

Ensure Docker Desktop is **running** before starting.

---

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd GP
npm install
```

This installs dependencies for all workspaces (API, Web, shared-types).

---

## Step 2: Start Database and Redis

```bash
npm run dev:infra
```

Starts PostgreSQL on port **5435** and Redis on port **6380** (non-default ports to avoid conflicts with local installations).

Verify containers are running:
```bash
docker ps
```

You should see `smart-restaurant-postgres` and `smart-restaurant-redis`.

---

## Step 3: Environment Setup

The `.env` and `apps/api/.env` files should already exist. If not:

```bash
# Root .env (for Docker Compose ports)
cp .env.example .env

# API .env (for database/redis connection)
cp apps/api/.env.example apps/api/.env
```

Default values work out of the box for local development.

---

## Step 4: Database Migration and Seed

```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Apply database migrations
npm run seed               # Seed demo data
```

The seed creates:
- 1 tenant ("Demo Restaurant Group"), 1 branch ("Downtown Branch")
- 4 staff accounts (owner, waiter, chef, cashier) — all with password `password123`
- 5 tables (T1–T5), 3 menu categories, 5 menu items, 3 item additions
- 4 inventory items, 2 tax rules, 4 roles with 39 permissions

---

## Step 5: Start the Backend

```bash
npm run dev:api
```

Wait for: `Nest application successfully started`

Verify:
```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "service": "api",
  "status": "degraded",
  "timestamp": "...",
  "dependencies": { "database": "ok", "redis": "ok", "ai": "unavailable" }
}
```

`status: "degraded"` is **normal** — it means the optional AI service is not running. All core features work.

---

## Step 6: Start the Frontend

```bash
npm run dev:web
```

Wait for: `Ready` or the Next.js compilation output.

Open **http://localhost:3000** in your browser.

---

## Step 7: Verify

### Smoke Test (API only)

```bash
npm run smoke
```

Expected: `15 passed, 0 failed`

### E2E Tests (requires frontend running)

```bash
npm run e2e
```

Expected: `24 passed` (~40 seconds)

### Full Suite

```bash
npm run test:all
```

Runs typecheck → build → smoke → E2E.

---

## Demo URLs

| URL | What | Login |
|---|---|---|
| http://localhost:3000 | Home (all surfaces) | None |
| http://localhost:3000/customer/start?branchId=seed-branch-1&tableCode=T1 | Customer ordering | Guest |
| http://localhost:3000/kitchen/login | Kitchen Display (KDS) | chef@demo.com |
| http://localhost:3000/waiter/login | Waiter Dashboard | waiter@demo.com |
| http://localhost:3000/admin/login | Admin Panel | owner@demo.com |

All staff passwords: `password123`

---

## Troubleshooting

### "EADDRINUSE" — port already in use

```bash
# Find what's using the port (Windows)
netstat -ano | findstr :4000

# Kill the process
taskkill /F /PID <pid>
```

Or change the port in `apps/api/.env`: `API_PORT=4001`

### Docker containers won't start

```bash
# Check Docker is running
docker ps

# If postgres port 5435 is in use
docker compose down
# Edit .env: POSTGRES_PORT=5436
docker compose up -d postgres redis
```

### "Cannot find module './383.js'" or similar Next.js cache error

```bash
rm -rf apps/web/.next
npm run dev:web
```

This is a known Windows file-system caching issue. The config uses in-memory caching to mitigate it.

### Prisma migration fails

```bash
cd apps/api
npx prisma migrate reset    # WARNING: drops all data
cd ../..
npm run seed                 # Re-seed demo data
```

### Smoke test sessions fail (400 error)

Tables may be in OCCUPIED state from a previous E2E run. Re-seed:

```bash
npm run seed
```

### npm execution policy error (Windows)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Redis connection refused

Ensure Redis container is running on port 6380:
```bash
docker ps | grep redis
```

If the container is not running: `npm run dev:infra`

---

## Optional: AI Service

The AI service is not required for core functionality but provides menu recommendations and chatbot.

```bash
cd apps/ai-services
python -m venv .venv
.venv/Scripts/activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

After starting, the API health endpoint will show `"ai": "ok"`.
