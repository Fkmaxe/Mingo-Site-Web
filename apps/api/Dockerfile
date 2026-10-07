# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Dependencies first, for the layer cache.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "api..."
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# Dependencies are bundled into dist/ (tsup.config.ts): the image needs no node_modules.
RUN pnpm --filter api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Migrations are applied at startup (docs/architecture.md), then the server replaces the shell.
CMD ["sh", "-c", "node --enable-source-maps dist/migrate.js && exec node --enable-source-maps dist/index.js"]
