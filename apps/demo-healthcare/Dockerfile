FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo-healthcare/package.json ./apps/demo-healthcare/
RUN npm ci --ignore-scripts --workspace=apps/demo-healthcare --workspace=packages/shared --workspace=packages/sdk

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ ./packages/
COPY --from=deps /app/apps/demo-healthcare/node_modules ./apps/demo-healthcare/node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo-healthcare/ ./apps/demo-healthcare/
COPY tsconfig.base.json ./
RUN cd packages/shared && npm run build
RUN cd packages/sdk && npm run build
RUN cd apps/demo-healthcare && npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 demohealth
COPY --from=build /app/apps/demo-healthcare/.next/standalone ./
COPY --from=build /app/apps/demo-healthcare/.next/static ./.next/static
COPY --from=build /app/apps/demo-healthcare/public ./public 2>/dev/null || true
USER demohealth
EXPOSE 3005
ENV PORT=3005 HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005 || exit 1
CMD ["node", "server.js"]
