# Smart Restaurant OS

Multi-tenant Smart Restaurant Operating System — a full-stack platform for dining, kitchen, waiter, and admin/POS operations.

The project is a modular SaaS restaurant-management platform. It supports public QR ordering, waiter workflows, kitchen display operations, admin/owner management, payments, inventory, analytics, and assistive AI behind backend-controlled boundaries.

## Architecture

| Layer | Technology | Location |
|---|---|---|
| Frontend | Next.js 15, React 19, TailwindCSS, React Query | `apps/web` |
| Backend API | NestJS 11, Prisma, PostgreSQL, Redis | `apps/api` |
| AI Services | FastAPI (Python) — optional | `apps/ai-services` |
| Shared Types | TypeScript contracts | `packages/shared-types` |

## Monorepo Structure

| Path | Purpose |
|---|---|
| `apps/web` | Next.js role-based frontend surfaces |
| `apps/api` | NestJS API, Prisma schema, backend domain modules |
| `apps/ai-services` | Optional FastAPI AI service boundary |
| `packages/shared-types` | Shared TypeScript contracts |
| `docs` | Architecture, operations, AI, deployment, and testing docs |
| `e2e` | Playwright end-to-end tests |

## Quick Start

### Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Python** 3.11+ for optional AI services
- **Docker Desktop** running
- **Git Bash** or PowerShell

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
npm run dev:infra
```

Starts PostgreSQL (port **5435**) and Redis (port **6380**).

### 3. Set up environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

### 4. Run database migration and seed

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 5. Start the backend

```bash
npm run dev:api
```

API at **http://localhost:4000** — verify: `curl http://localhost:4000/api/health`

### 6. Optional: start the Python AI service

The backend works without this service, but AI-assisted features such as menu chat and business insight summaries can use it when `AI_SERVICE_URL` points to the FastAPI server.

From PowerShell:

```powershell
cd apps/ai-services
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

From Git Bash, macOS, or Linux:

```bash
cd apps/ai-services
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

AI service at **http://localhost:8000** — verify: `curl http://localhost:8000/health`

To let the NestJS backend call it, set this in `apps/api/.env`:

```env
AI_SERVICE_URL=http://localhost:8000
```

When returning later, reactivate the virtual environment before starting the server:

```powershell
cd apps/ai-services
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 7. Start the frontend

```bash
npm run dev:web
```

Web at **http://localhost:3000**

### 8. Verify

```bash
npm run smoke
```

Runs 16-point API smoke test.

## Demo Guide

### Demo URLs

| URL | Surface | Auth |
|---|---|---|
| http://localhost:3000 | Home — all surfaces + credentials | None |
| http://localhost:3000/customer/start?branchId=seed-branch-1&tableCode=T1 | Customer ordering | Guest |
| http://localhost:3000/customer/login | Customer OTP login | Phone |
| http://localhost:3000/kitchen | Kitchen Display (KDS) | chef@demo.com |
| http://localhost:3000/waiter | Waiter Dashboard | waiter@demo.com |
| http://localhost:3000/admin | Admin / POS | owner@demo.com |

### Credentials

All passwords: `password123`

| Role | Email | Access |
|---|---|---|
| Owner | owner@demo.com | Full admin, analytics, menu, inventory, promotions, staff, POS |
| Cashier | cashier@demo.com | POS, payments, shifts, tills, coupons, gift cards |
| Waiter | waiter@demo.com | Tables, sessions, service requests, KDS view, attendance |
| Chef | chef@demo.com | KDS queue, item status controls |

### Seeded Data

- **Branches**: seed-branch-1 ("Downtown Branch"), seed-branch-2 ("Waterfront Branch")
- **Tables**: T1–T5 (2-8 seats, various locations)
- **Menu**: 3 categories, 5 items, 3 additions
- **Tax**: Food 5%, Beverage 10%
- **Inventory**: 4 items with menu mappings
- **Permissions**: 41 across 4 roles

## Developer Commands

```bash
# Infrastructure
npm run dev:infra          # Start Postgres + Redis
npm run dev:down           # Stop Docker services

# Applications
npm run dev:api            # Start backend (:4000)
npm run dev:web            # Start frontend (:3000)

# AI service
cd apps/ai-services
.\.venv\Scripts\Activate.ps1
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
npm run smoke:health       # Lightweight API health check; no seed data required
npm run smoke              # 16-point API smoke test
```

## Production Readiness

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | 64+ byte random hex string |
| `API_PORT` | No | Default: 4000 |
| `NEXT_PUBLIC_API_BASE_URL` | Yes (web) | Backend URL for frontend |
| `AI_SERVICE_URL` | No | FastAPI service URL |
| `PAYMENT_PROVIDER` | No | `stripe` or `mock` (default: mock) |
| `STRIPE_SECRET_KEY` | If Stripe | Stripe secret key (sk_test_... or sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | If Stripe | Stripe webhook signing secret (whsec_...) |

See `.env.production.example` for full production template.

### Before Production Checklist

- [ ] Generate strong `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Set `NODE_ENV=production`
- [ ] Use managed PostgreSQL with SSL
- [ ] Use managed Redis with auth
- [ ] Enforce HTTPS via reverse proxy
- [ ] Restrict CORS to production origins
- [ ] Integrate SMS provider for OTP
- [ ] Configure Stripe live keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- [ ] Migrate auth tokens to httpOnly cookies
- [ ] Add CSP headers
- [ ] Add request logging / monitoring

### Security Notes

| Area | Status | Note |
|------|--------|------|
| Tenant/branch isolation | Implemented in critical services | `BranchAccessService` centralizes branch access checks |
| Public QR ordering | Hardened | Tenant/branch/table and totals are derived server-side |
| Payment amounts | Hardened | Payment intents and manual flows use server-calculated amount due |
| Inventory mutations | Hardened | Served-time decrement and manual adjustment are transactional and audited |
| DTO validation | Active | Global ValidationPipe uses whitelist, forbidNonWhitelisted, transform |
| AI summaries | Defensive | Real metrics are computed first; AI output is validated with fallback behavior |
| Auth tokens | localStorage in parts of frontend | Continue migration toward httpOnly cookies for production |
| OTP codes | Dev-mode only | `_dev_otp` gated behind `NODE_ENV=development` |
| Card data | Never stored ✅ | PCI-compliant by design |
| Rate limiting | Active ✅ | Login: 10/min, OTP: 5/min, General: 100/min |
| CORS | Open (dev) | Whitelist origins in production |
| Frontend permissions | UX only | Backend remains source of truth |

## Troubleshooting

### Port conflicts

Default ports 5435/6380 avoid conflicts with local PostgreSQL/Redis. If still in use:
```bash
# Check what's using a port (Windows)
netstat -ano | findstr :5435
# Change ports in .env and docker-compose
```

### Prisma migration issues

```bash
cd apps/api
npx prisma migrate reset    # WARNING: drops all data
npm run seed                 # Re-seed demo data
```

### Windows Prisma EPERM during build

If `npm run build --workspace @smart-restaurant/api` fails during `prisma generate` with an `EPERM` rename error for `query_engine-windows.dll.node`, stop running Node/API/Prisma processes and retry. This is a Windows file-locking issue with the generated Prisma engine file. See [docs/deployment.md](docs/deployment.md#known-windows-prisma-eperm-issue).

### Health shows "degraded"

Normal — AI service (FastAPI) isn't running. API works fully without it.

### Next.js cache errors

```bash
rm -rf apps/web/.next
npm run dev:web
```

### npm execution policy (Windows)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Graduation Delivery Docs

Complete documentation package for evaluation, demo, and presentation:

| Document | Description |
|---|---|
| [Project Overview](docs/graduation/overview.md) | Problem statement, solution, architecture, tech stack |
| [Feature Matrix](docs/graduation/feature-matrix.md) | Module-by-module feature inventory with coverage status |
| [Demo Script](docs/graduation/demo-script.md) | Step-by-step live demo plan with talking points |
| [API Summary](docs/graduation/api-summary.md) | All 155 endpoints across 24 modules |
| [Testing Report](docs/graduation/testing-report.md) | 24 E2E + 15 smoke tests, coverage details |
| [Spec Parity Report](docs/graduation/spec-parity-report.md) | Feature-by-feature comparison vs ProjectPlane.md |
| [Installation Guide](docs/graduation/installation-guide.md) | Evaluator-focused setup in 10-15 minutes |
| [Architecture Notes](docs/graduation/architecture-notes.md) | Design decisions, trade-offs, security |
| [Presentation Notes](docs/graduation/presentation-notes.md) | 1/5/10-min talking points, examiner Q&A |
| [Screenshot Checklist](docs/graduation/screenshot-checklist.md) | Screenshots to capture for the report |

Additional operational docs:

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System structure and Mermaid flow diagrams |
| [Security Model](docs/security.md) | Tenant/branch isolation, public order, payment, inventory, DTO, and AI safety |
| [API Overview](docs/api-overview.md) | High-level backend route group map |
| [Testing Guide](docs/testing.md) | Focused `tsx` tests and `test:critical` coverage |
| [AI Features](docs/ai-features.md) | AI data flow, fallback behavior, validation, and limitations |
| [Deployment Guide](docs/deployment.md) | Docker production setup, Nginx, environment |
| [Demo Readiness](docs/demo-readiness.md) | Pre-demo commands, golden path, fallback plan, and risks |
| [Operations Runbook](docs/operations.md) | Backup/restore, health checks, troubleshooting |
| [Monitoring Guide](docs/monitoring.md) | Prometheus, alerts, production readiness checklist |

## Project Status

See [docs/project-status.md](docs/project-status.md) for complete module inventory, security matrix, roadmap, and risk register.

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs on push/PR to main:
- Install dependencies
- Validate and generate Prisma client
- Apply Prisma migrations against CI PostgreSQL
- Typecheck all workspaces
- Run `test:critical`
- Build frontend
- Build API

GitHub Actions workflow at `.github/workflows/release-images.yml` publishes production images to GHCR on pushes to `main`, version tags such as `v1.0.0`, and manual dispatch:
- `ghcr.io/<owner>/smart-restaurant-os-api`
- `ghcr.io/<owner>/smart-restaurant-os-web`
- `ghcr.io/<owner>/smart-restaurant-os-ai`

For a VPS that should deploy published images instead of building on-host:

1. Set `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` in `.env.production`.
2. Run `npm run docker:prod:pull`.
3. Run `npm run docker:prod:up`.
4. Run migrations and the production smoke gates as usual.

`npm run smoke:health` checks the running API health endpoint without seed data. `npm run smoke` requires a running API with migrated and seeded database.
