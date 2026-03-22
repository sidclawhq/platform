FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo-devops/package.json ./apps/demo-devops/
RUN git init && npm ci && rm -rf .git

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo-devops/ ./apps/demo-devops/
COPY package.json turbo.json tsconfig.base.json ./
RUN cd packages/shared && npm run build
RUN cd packages/sdk && npm run build
RUN cd apps/demo-devops && npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=build /app/apps/demo-devops/.next/standalone ./
COPY --from=build /app/apps/demo-devops/.next/static ./apps/demo-devops/.next/static
USER nextjs
EXPOSE 3004
ENV PORT=3004 HOSTNAME="0.0.0.0"
CMD ["node", "apps/demo-devops/server.js"]
