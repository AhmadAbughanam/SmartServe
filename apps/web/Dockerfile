# ── Stage 1: Install dependencies ────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare npm@11.6.4 --activate

# Copy workspace root manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/

# Install all dependencies (needed for build).
# npm workspaces hoists everything to root node_modules.
RUN npm ci

# ── Stage 2: Build ───────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare npm@11.6.4 --activate

# Copy hoisted node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files needed for build
COPY package.json tsconfig.base.json ./
COPY apps/web/ apps/web/
COPY packages/shared-types/ packages/shared-types/

# NEXT_PUBLIC_ vars must be set at build time (baked into client bundle).
# In production behind Nginx, use empty string so API calls are same-origin.
# Next.js lockfile patching is unreliable in this npm-workspaces repo even though the
# required SWC packages are already present in package-lock.json.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1

# Build Next.js (produces .next/standalone for Docker)
RUN npm run build --workspace=@smart-restaurant/web

# ── Stage 3: Production runtime ──────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone server (includes only required node_modules)
COPY --from=build /app/apps/web/.next/standalone ./

# Copy static assets (not included in standalone)
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
COPY --from=build /app/apps/web/public apps/web/public

EXPOSE 3000

# The standalone server is at apps/web/server.js
CMD ["node", "apps/web/server.js"]
