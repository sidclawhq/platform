# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/shared --ignore-scripts

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build shared package
RUN cd packages/shared && npx tsc --build

# Build API
RUN cd apps/api && npx tsc --build

# Copy generated Prisma client into dist so compiled JS can resolve it.
# db/client.js imports from ../generated/prisma/index.js — this must exist
# relative to dist/db/client.js, i.e. at dist/generated/prisma/.
RUN cp -r apps/api/src/generated apps/api/dist/generated

# Prepare production node_modules (omit devDependencies)
RUN npm ci --workspace=apps/api --workspace=packages/shared --omit=dev --ignore-scripts

# Point shared package exports to compiled dist for production runtime
RUN node -e "\
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('packages/shared/package.json', 'utf8')); \
  pkg.main = './dist/index.js'; \
  pkg.exports = { '.': { types: './dist/index.d.ts', default: './dist/index.js' } }; \
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(pkg, null, 2));"

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

# Install Prisma CLI for running migrations on startup
RUN npm install -g prisma@7

# Copy monorepo structure needed at runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json

WORKDIR /app/apps/api

USER api

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

EXPOSE 4000

# Run migrations then start server
CMD ["sh", "-c", "prisma migrate deploy && node dist/server.js"]
