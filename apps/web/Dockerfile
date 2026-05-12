FROM node:20-alpine AS base
RUN npm install -g pnpm@9.11.0

FROM base AS deps
WORKDIR /monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /monorepo
COPY --from=deps /monorepo/node_modules ./node_modules
COPY --from=deps /monorepo/apps/web/node_modules ./apps/web/node_modules
COPY packages/ packages/
COPY apps/web/ apps/web/
WORKDIR /monorepo/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost
ARG NEXT_PUBLIC_APP_URL=http://localhost
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN pnpm build

FROM base AS runner
WORKDIR /monorepo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /monorepo/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /monorepo/packages ./packages
COPY --from=builder --chown=nextjs:nodejs /monorepo/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder --chown=nextjs:nodejs /monorepo/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /monorepo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /monorepo/apps/web/package.json ./apps/web/package.json

USER nextjs
WORKDIR /monorepo/apps/web
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node_modules/.bin/next", "start"]
