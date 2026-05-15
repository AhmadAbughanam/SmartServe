# ── Stage 1: Install dependencies ────────────────────
FROM node:20-alpine AS deps

# bcrypt needs build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/

# Install all dependencies (needed for build).
# npm workspaces hoists everything to root node_modules.
RUN npm ci

# ── Stage 2: Build ───────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy hoisted node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files needed for build
COPY package.json tsconfig.base.json ./
COPY apps/api/ apps/api/
COPY packages/shared-types/ packages/shared-types/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Compile TypeScript
RUN npm run build --workspace=@smart-restaurant/api

# ── Stage 3: Production runtime ──────────────────────
FROM node:20-alpine AS production

# bcrypt native bindings need libstdc++
RUN apk add --no-cache libstdc++

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/

# Install production dependencies only
RUN apk add --no-cache python3 make g++ \
    && npm ci --omit=dev \
    && apk del python3 make g++

# Copy compiled output
COPY --from=build /app/apps/api/dist apps/api/dist

# Copy Prisma schema + generated client
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma

# Copy shared-types source (referenced at runtime by compiled imports)
COPY packages/shared-types/src packages/shared-types/src

EXPOSE 4000

# Run from the API workspace directory
WORKDIR /app/apps/api

CMD ["node", "dist/main.js"]
