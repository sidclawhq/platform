FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo/package.json ./apps/demo/
RUN git init && npm ci --include=dev && rm -rf .git

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY --from=deps /app/apps/demo/node_modules ./apps/demo/node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo/ ./apps/demo/
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
RUN npm run build -w packages/shared
RUN npm run build -w packages/sdk
RUN npm run build -w apps/demo

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=build /app/apps/demo/.next/standalone ./
COPY --from=build /app/apps/demo/.next/static ./apps/demo/.next/static
USER nextjs
EXPOSE 3003
ENV PORT=3003 HOSTNAME="0.0.0.0"
CMD ["node", "apps/demo/server.js"]
