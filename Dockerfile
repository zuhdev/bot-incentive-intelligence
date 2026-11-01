FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ARG DIRECT_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ARG AUTH_SECRET=build-only-secret-0123456789abcdef0123456789abcdef
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_DATABASE_URL=$DIRECT_DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV BOT_NETWORK=testnet
RUN npm run build:postgres

FROM base AS runner
ENV NODE_ENV=production
ENV BOT_NETWORK=testnet
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "start"]
