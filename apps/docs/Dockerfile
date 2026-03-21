# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/docs/package.json ./apps/docs/

RUN npm ci --workspace=apps/docs

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/docs/node_modules ./apps/docs/node_modules

COPY apps/docs/ ./apps/docs/
COPY tsconfig.base.json ./

RUN cd apps/docs && npm run build

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/docs/.next/standalone ./
COPY --from=build /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=build /app/apps/docs/public ./apps/docs/public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001 || exit 1

CMD ["node", "apps/docs/server.js"]
