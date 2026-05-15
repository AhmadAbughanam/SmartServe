# AGENTS.md

This repository is a multi-tenant Smart Restaurant Operating System. If you are Claude or another coding agent working in this repo, use this file as the operating contract for how to think, decide, and update project state.

## Read Order

Before making material changes, read these files in order:

1. `README.md`
2. `ProjectPlane.md`
3. `docs/system-spec.md`
4. `docs/architecture.md`
5. `docs/diagrams-notes.md`
6. `context.md`
7. `memory.md`

## Mission

Build a restaurant operations platform that supports:

- customer QR/NFC ordering
- waiter/staff service workflows
- kitchen display workflows
- admin/owner management and analytics
- multi-tenant and multi-branch isolation
- assistive AI features behind backend-controlled boundaries

## Core Principles

- Tenant and branch scoping are mandatory, not optional.
- Business modules must not bypass the API boundary to talk directly to databases or AI services.
- External integrations must be behind adapters or provider contracts.
- Realtime behavior should be event-driven and traceable.
- Prefer simple local-development infrastructure first, then increase complexity only when justified.

## Repo Shape

- `apps/web`: Next.js frontend with role-based surfaces
- `apps/api`: NestJS backend
- `apps/ai-services`: FastAPI AI microservice boundary
- `packages/shared-types`: shared TS types and event contracts
- `docs/`: architecture and diagram notes

## Decision Factors

When multiple implementation options exist, prioritize in this order:

1. tenant safety
2. operational correctness
3. simplicity of local development
4. clear backend boundaries
5. future extensibility
6. performance optimization

Do not choose a shortcut that weakens tenant isolation, auditability, or scope enforcement.

## Triggers

Use these triggers to decide what to inspect or update:

- If the task touches auth, roles, or permissions:
  inspect `apps/api`, shared role types, and tenant/branch guards.
- If the task touches ordering, table flow, or KDS:
  inspect `apps/api`, `apps/web`, shared event types, and realtime design.
- If the task touches payments:
  inspect provider contracts and keep gateway logic adapter-based.
- If the task touches AI:
  keep AI calls behind backend orchestration and log tenant-scoped inputs/outputs.
- If the task touches schema or entities:
  update Prisma carefully and keep naming consistent with business language.
- If the task changes architecture, assumptions, or boundaries:
  update `context.md` and `memory.md`.

## Required Behaviors

- Make small, coherent changes unless a larger refactor is clearly necessary.
- Record important decisions in `memory.md`.
- Update `context.md` when stable project understanding changes.
- Prefer adding explicit contracts over hidden coupling.
- Treat the current repo as a scaffold; preserve flexibility where requirements are still undecided.

## Current Constraints

- Payment gateway is not finalized.
- Auth strategy details are still not finalized, but JWT + refresh token is the current baseline.
- External module rollout order is not finalized.
- Provider implementations are still placeholders even though the core schema is now defined.

## Done Criteria

A task is not complete unless these are true where relevant:

- code or docs are updated consistently
- environment assumptions still match the repo
- `memory.md` reflects the new decision or state change
- no new hidden coupling was introduced across frontend, backend, and AI boundaries
