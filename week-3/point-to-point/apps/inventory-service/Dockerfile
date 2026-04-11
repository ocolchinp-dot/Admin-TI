FROM node:22-slim

RUN corepack enable
WORKDIR /app
ENV CI=true

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @p2p/contracts build
RUN pnpm --filter inventory-service build

WORKDIR /app/apps/inventory-service

EXPOSE 3001

CMD ["pnpm", "start"]
