FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo-healthcare/package.json ./apps/demo-healthcare/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo-healthcare/ ./apps/demo-healthcare/
COPY package.json turbo.json tsconfig.base.json ./
RUN cd packages/shared && npm run build
RUN cd packages/sdk && npm run build
RUN cd apps/demo-healthcare && npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=build /app/apps/demo-healthcare/.next/standalone ./
COPY --from=build /app/apps/demo-healthcare/.next/static ./apps/demo-healthcare/.next/static
USER nextjs
EXPOSE 3005
ENV PORT=3005 HOSTNAME="0.0.0.0"
CMD ["node", "apps/demo-healthcare/server.js"]
