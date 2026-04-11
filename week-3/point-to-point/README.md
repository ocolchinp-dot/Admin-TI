# Monorepo P2P: Orders + Inventory

Ejemplo de arquitectura punto-a-punto con 2 microservicios Node.js en un monorepo Turbo:

- `inventory-service` (Hono + PostgreSQL)
- `orders-service` (Express + PostgreSQL)

`orders-service` se comunica por HTTP con `inventory-service` para validar/reservar stock antes de confirmar una orden.

## Requisitos

- Node.js 22+
- pnpm
- Docker + Docker Compose

## Estructura

- `apps/inventory-service`: API de inventario
- `apps/orders-service`: API de órdenes
- `packages/contracts`: tipos y esquemas compartidos
- `drizzle`: historial SQL de migraciones

## Instalación

```bash
pnpm install
```

## Migraciones (Drizzle Kit)

Generar una nueva migración desde los schemas TypeScript:

```bash
pnpm db:generate
```

Aplicar migraciones:

```bash
DATABASE_URL=postgres://p2p:p2p@localhost:5432/p2p pnpm db:migrate
```

## Desarrollo local (sin Docker)

1. Levanta PostgreSQL local (o con Docker).
2. Exporta variables de entorno:

```bash
export INVENTORY_DATABASE_URL=postgres://p2p:p2p@localhost:5432/p2p
export ORDERS_DATABASE_URL=postgres://p2p:p2p@localhost:5432/p2p
```

3. Corre migraciones y luego los servicios:

```bash
pnpm db:migrate
pnpm dev
```

Servicios:

- Inventory: [http://localhost:3001](http://localhost:3001)
- Orders: [http://localhost:3000](http://localhost:3000)

## Build y tests

```bash
pnpm build
pnpm test
```

## Docker Compose

`docker-compose.yml` levanta:

- `postgres`
- `db-migrate` (job one-shot de migraciones)
- `inventory-service`
- `orders-service`

Ejecutar:

```bash
docker compose up --build
```

## Smoke test (curl)

1. Seed de inventario:

```bash
curl -X POST http://localhost:3001/inventory/seed \
  -H "Content-Type: application/json" \
  -d '{"items":[{"sku":"SKU-123","stock":5}]}'
```

2. Crear orden válida:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-123","quantity":2}'
```

3. Crear orden sin stock:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-123","quantity":10}'
```

4. Consultar stock restante:

```bash
curl http://localhost:3001/inventory/SKU-123
```

5. Consultar una orden por id:

```bash
curl http://localhost:3000/orders/1
```

## Endpoints

### inventory-service (`:3001`)

- `GET /health`
- `GET /inventory/:sku`
- `POST /inventory/seed`
- `POST /inventory/reserve`

### orders-service (`:3000`)

- `GET /health`
- `POST /orders`
- `GET /orders/:id`

## Notas

- Las tablas viven en schemas separados dentro de una sola base PostgreSQL:
  - `inventory.inventory`
  - `orders.orders`
- Estado de migraciones versionado en `drizzle/meta`.

## Logging

Los servicios emiten logs estructurados en JSON con campos consistentes:

- `timestamp`
- `level` (`DEBUG`, `INFO`, `WARN`, `ERROR`)
- `service`
- `runtime`
- `version`
- `hostname`
- `event`

Variables opcionales:

```bash
LOG_LEVEL=INFO
LOG_REDACT_KEYS=password,token,authorization,cookie,secret,api_key,apikey
APP_VERSION=1.0.0
```
