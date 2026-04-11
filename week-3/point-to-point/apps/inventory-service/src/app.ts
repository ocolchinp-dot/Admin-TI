import { Hono } from "hono";
import { reserveRequestSchema } from "@p2p/contracts";
import { z } from "zod";
import type { InventoryRepositoryPort } from "./db";
import { logError, logEvent } from "./logger";

const seedRequestSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string().min(1),
      stock: z.number().int().nonnegative()
    })
  ).min(1)
});

export function createInventoryApp(repo: InventoryRepositoryPort): Hono {
  const app = new Hono();
  app.use("*", async (c, next) => {
    const flowId = c.req.header("x-flow-id") ?? "n/a";
    const start = Date.now();
    c.header("x-flow-id", flowId);

    try {
      await next();
    } finally {
      const statusCode = c.res?.status ?? 500;
      logEvent(
        "http.request",
        {
          flowId,
          method: c.req.method,
          path: c.req.path,
          statusCode,
          durationMs: Date.now() - start
        },
        statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO"
      );
    }
  });

  app.onError((error, c) => {
    const flowId = c.req.header("x-flow-id") ?? "n/a";
    const isDependencyUnavailable = isDependencyError(error);
    const statusCode = isDependencyUnavailable ? 503 : 500;
    logError("inventory.request.failed", error, {
      flowId,
      method: c.req.method,
      path: c.req.path,
      statusCode
    });

    return c.json(
      { error: isDependencyUnavailable ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR" },
      statusCode
    );
  });

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "inventory" });
  });

  app.get("/inventory/:sku", async (c) => {
    const flowId = c.req.header("x-flow-id") ?? "n/a";
    const sku = c.req.param("sku"); // SKU-123
    const stock = await repo.getStock(sku);

    if (stock === null) {
      logEvent("inventory.get.not_found", { flowId, sku });
      return c.json({ error: "SKU_NOT_FOUND" }, 404);
    }

    logEvent("inventory.get.found", { flowId, sku, stock });
    return c.json({ sku, stock });
  });

  app.post("/inventory/seed", async (c) => {
    const flowId = c.req.header("x-flow-id") ?? "n/a";
    const body = await c.req.json().catch(() => null);
    const parsed = seedRequestSchema.safeParse(body);

    if (!parsed.success) {
      logEvent(
        "inventory.seed.invalid_payload",
        { flowId, issues: parsed.error.issues },
        "WARN"
      );
      return c.json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues }, 400);
    }

    logEvent("inventory.seed.received", {
      flowId,
      items: parsed.data.items.map((item) => ({ sku: item.sku, stock: item.stock }))
    });
    await repo.seed(parsed.data.items);
    logEvent("inventory.seed.completed", { flowId, count: parsed.data.items.length });
    return c.json({ seeded: parsed.data.items.length });
  });

  app.post("/inventory/reserve", async (c) => {
    const flowId = c.req.header("x-flow-id") ?? "n/a";
    const body = await c.req.json().catch(() => null);
    const parsed = reserveRequestSchema.safeParse(body);

    logEvent("inventory.reserve.received", { flowId, body });

    if (!parsed.success) {
      logEvent(
        "inventory.reserve.invalid_payload",
        { flowId, issues: parsed.error.issues },
        "WARN"
      );
      return c.json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues }, 400);
    }

    const result = await repo.reserve(parsed.data.sku, parsed.data.quantity);

    if (!result.reserved) {
      logEvent("inventory.reserve.out_of_stock", {
        flowId,
        sku: parsed.data.sku,
        quantity: parsed.data.quantity
      });
      return c.json(result, 409);
    }

    logEvent("inventory.reserve.success", {
      flowId,
      sku: parsed.data.sku,
      quantity: parsed.data.quantity,
      remaining: result.remaining
    });
    return c.json(result, 200);
  });

  return app;
}

function isDependencyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const source = error as unknown as { code?: unknown; message?: unknown };
  const code = typeof source.code === "string" ? source.code : undefined;
  if (
    code &&
    new Set([
      "ENOTFOUND",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "EPIPE",
      "08001",
      "08006",
      "57P01",
      "57P02",
      "57P03"
    ]).has(code)
  ) {
    return true;
  }

  const message = String(source.message ?? "").toLowerCase();
  return (
    message.includes("connection terminated") ||
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("getaddrinfo")
  );
}
