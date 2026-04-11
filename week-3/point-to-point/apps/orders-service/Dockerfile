FROM node:22-slim

RUN corepack enable
WORKDIR /app
ENV CI=true

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @p2p/contracts build
RUN pnpm --filter orders-service build

WORKDIR /app/apps/orders-service

EXPOSE 3000

CMD ["pnpm", "start"]
