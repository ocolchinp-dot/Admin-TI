import { serve } from "@hono/node-server";
import { createInventoryApp } from "./app";
import { InventoryRepository } from "./db";
import { logError, logEvent } from "./logger";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl =
  process.env.INVENTORY_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing INVENTORY_DATABASE_URL (or DATABASE_URL) environment variable"
  );
}

const repo = new InventoryRepository(databaseUrl);
const app = createInventoryApp(repo);

logEvent("service.started", { port });
serve({ fetch: app.fetch, port });

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
