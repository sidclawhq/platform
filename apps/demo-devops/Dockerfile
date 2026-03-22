FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo-devops/package.json ./apps/demo-devops/
RUN npm ci --workspace=apps/demo-devops --workspace=packages/shared --workspace=packages/sdk

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ ./packages/
COPY --from=deps /app/apps/demo-devops/node_modules ./apps/demo-devops/node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo-devops/ ./apps/demo-devops/
COPY tsconfig.base.json ./
RUN cd packages/shared && npm run build
RUN cd packages/sdk && npm run build
RUN cd apps/demo-devops && npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 demodevops
COPY --from=build /app/apps/demo-devops/.next/standalone ./
COPY --from=build /app/apps/demo-devops/.next/static ./.next/static
COPY --from=build /app/apps/demo-devops/public ./public 2>/dev/null || true
USER demodevops
EXPOSE 3004
ENV PORT=3004 HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004 || exit 1
CMD ["node", "server.js"]
