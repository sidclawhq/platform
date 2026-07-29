FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo-healthcare/package.json ./apps/demo-healthcare/
RUN git init && npm ci --include=dev && rm -rf .git
# npm decides per-lockfile whether a workspace gets a nested node_modules
# (hoisting). The build stage COPYs these paths, and COPY has no
# if-exists — guarantee the dirs so a hoisting change can't break the build.
RUN mkdir -p packages/sdk/node_modules packages/shared/node_modules apps/demo-healthcare/node_modules

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo-healthcare/ ./apps/demo-healthcare/
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
RUN npm run build -w packages/shared
RUN npm run build -w packages/sdk
RUN npm run build -w apps/demo-healthcare

FROM node:24-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=build /app/apps/demo-healthcare/.next/standalone ./
COPY --from=build /app/apps/demo-healthcare/.next/static ./apps/demo-healthcare/.next/static
USER nextjs
EXPOSE 3005
ENV PORT=3005 HOSTNAME="0.0.0.0"
CMD ["node", "apps/demo-healthcare/server.js"]
