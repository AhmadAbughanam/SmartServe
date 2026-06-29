# Local Development

This guide explains how to set up and run the project locally for development and testing.

## Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Python** 3.11+ for optional AI services
- **Docker Desktop** running
- **Git Bash** or PowerShell

## 1. Install dependencies

```bash
npm install
```

## 2. Start infrastructure

```bash
npm run dev:infra
```

Starts PostgreSQL (port **5435**), Redis (port **6380**), and MinIO object storage (API **9000**, console **9001**).

## 3. Set up environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

## 4. Run database migration and seed

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## 5. Start the backend

```bash
npm run dev:api
```

API at **http://localhost:4000** — verify: `curl http://localhost:4000/api/health`

## 6. Optional: start the Python AI service

The backend works without this service, but several AI-assisted paths use it when `AI_SERVICE_URL` points to the FastAPI server.

Current FastAPI-backed features include:

- menu chat helper
- demand forecasting
- business insight summarization
- review sentiment summarization
- recommendation reranking
- business insight inference
- review sentiment inference

From PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r apps/ai-services/requirements.txt
cd apps/ai-services
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

From Git Bash, macOS, or Linux:

```bash
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r apps/ai-services/requirements.txt
cd apps/ai-services
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

AI service at **http://localhost:8000** — verify: `curl http://localhost:8000/health`

Optional capability check:

```bash
curl http://localhost:8000/capabilities
```

To let the NestJS backend call it, set this in `apps/api/.env`:

```env
AI_SERVICE_URL=http://localhost:8000
```

## 7. Start the frontend

```bash
npm run dev:web
```

Web at **http://localhost:3000**

## 8. Verify

```bash
npm run smoke
```

Runs 16-point API smoke test.

## Demo Guide

### Demo URLs

| URL | Surface | Auth |
|---|---|---|
| http://localhost:3000 | Home — all surfaces + credentials | None |
| http://localhost:3000/login | Unified customer/staff login | Staff credentials or customer OTP |
| http://localhost:3000/customer/start?branchId=seed-branch-1&tableCode=T1 | Customer ordering | Guest |
| http://localhost:3000/customer/login | Customer OTP login | Phone |
| http://localhost:3000/kitchen | Kitchen Display (KDS) | chef@demo.com |
| http://localhost:3000/waiter | Waiter Dashboard | waiter@demo.com |
| http://localhost:3000/admin | Admin / POS | owner@demo.com |
| http://localhost:3000/saas | SaaS Owner Dashboard | saas@demo.com |

### Credentials

All passwords: `password123`

| Role | Email | Access |
|---|---|---|
| Owner | owner@demo.com | Full admin, analytics, menu, inventory, promotions, staff, POS |
| SaaS Owner | saas@demo.com | Global tenants, store owners, SaaS analytics, branch feature modules |
| Cashier | cashier@demo.com | POS, payments, shifts, tills, coupons, gift cards |
| Waiter | waiter@demo.com | Tables, sessions, service requests, KDS view, attendance |
| Chef | chef@demo.com | KDS queue, item status controls |

## Developer Commands

```bash
# Infrastructure
npm run dev:infra          # Start Postgres + Redis
npm run dev:down           # Stop Docker services

# Applications
npm run dev:api            # Start backend (:4000)
npm run dev:web            # Start frontend (:3000)

# AI service
.\.venv\Scripts\Activate.ps1
cd apps/ai-services
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations
npm run prisma:validate    # Validate schema
npm run seed               # Seed demo data

# Quality
npm run typecheck          # Typecheck all workspaces
npm run typecheck:api      # Typecheck backend only
npm run typecheck:web      # Typecheck frontend only
npm run test:critical      # Run critical backend business/security tests
npm run build              # Build all workspaces
npm run build:api          # Build backend only
npm run build:web          # Build frontend only
npm run secrets:production # Generate strong .env.production secret values
npm run smoke:health       # Lightweight API health check; no seed data required
npm run smoke:production -- https://your-domain  # Production edge smoke check
npm run smoke              # 16-point API smoke test
npm run monitoring:up      # Start production stack + monitoring/log aggregation overlay
```
