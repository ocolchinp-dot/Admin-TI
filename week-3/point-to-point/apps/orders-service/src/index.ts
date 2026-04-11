import { createOrdersApp } from "./app";
import { OrdersRepository } from "./db";
import { HttpInventoryClient } from "./inventory-client";
import { logError, logEvent } from "./logger";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.ORDERS_DATABASE_URL ?? process.env.DATABASE_URL;
const inventoryBaseUrl = process.env.INVENTORY_BASE_URL ?? "http://localhost:3001";

if (!databaseUrl) {
  throw new Error(
    "Missing ORDERS_DATABASE_URL (or DATABASE_URL) environment variable"
  );
}

const repo = new OrdersRepository(databaseUrl);
const inventoryClient = new HttpInventoryClient(inventoryBaseUrl);
const app = createOrdersApp(repo, inventoryClient);

app.listen(port, () => {
  logEvent("service.started", { port });
});

const shutdown = async () => {
  logEvent("service.shutdown.requested", {});
  await repo.close();
  logEvent("service.stopped", {});
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (reason) => {
  logError("process.unhandled_rejection", reason);
});
process.on("uncaughtException", (error) => {
  logError("process.uncaught_exception", error);
  process.exit(1);
});
