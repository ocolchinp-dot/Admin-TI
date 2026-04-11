import express, {
  type NextFunction,
  type Request,
  type Response
} from "express";
import { randomUUID } from "node:crypto";
import { createOrderSchema } from "@p2p/contracts";
import type { OrdersRepositoryPort } from "./db";
import type { InventoryClient } from "./inventory-client";
import { logError, logEvent } from "./logger";
import { placeOrder } from "./service";

export function createOrdersApp(
  repo: OrdersRepositoryPort,
  inventoryClient: InventoryClient
): express.Express {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    const flowId = req.header("x-flow-id") ?? randomUUID();
    res.setHeader("x-flow-id", flowId);
    res.locals.flowId = flowId;
    const start = Date.now();

    res.on("finish", () => {
      const statusCode = res.statusCode;
      logEvent(
        "http.request",
        {
          flowId,
          method: req.method,
          path: req.path,
          statusCode,
          durationMs: Date.now() - start
        },
        statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO"
      );
    });

    next();
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "orders" });
  });

  app.post("/orders", async (req: Request, res: Response) => {
    const flowId = String(res.locals.flowId);
    const parsed = createOrderSchema.safeParse(req.body);

    logEvent("orders.create.received", { flowId, body: req.body });

    if (!parsed.success) {
      logEvent(
        "orders.create.invalid_payload",
        { flowId, issues: parsed.error.issues },
        "WARN"
      );
      res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
      return;
    }

    try {
      const result = await placeOrder(repo, inventoryClient, parsed.data, { flowId });
      logEvent("orders.create.completed", {
        flowId,
        orderId: result.order.id,
        statusCode: result.statusCode,
        orderStatus: result.order.status,
        sku: result.order.sku,
        quantity: result.order.quantity
      });
      res.status(result.statusCode).json(result.order);
    } catch (error) {
      const isDependencyUnavailable = isDependencyError(error);
      const statusCode = isDependencyUnavailable ? 503 : 500;
      logError("orders.create.failed", error, {
        flowId,
        statusCode,
        sku: parsed.data.sku,
        quantity: parsed.data.quantity
      });
      res.status(statusCode).json({
        error: isDependencyUnavailable ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR"
      });
    }
  });

  app.get("/orders/:id", async (req: Request, res: Response) => {
    const flowId = String(res.locals.flowId);
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      logEvent("orders.get.invalid_id", { flowId, providedId: req.params.id }, "WARN");
      res.status(400).json({ error: "INVALID_ID" });
      return;
    }

    let order;
    try {
      order = await repo.getOrderById(id);
    } catch (error) {
      const isDependencyUnavailable = isDependencyError(error);
      const statusCode = isDependencyUnavailable ? 503 : 500;
      logError("orders.get.failed", error, {
        flowId,
        orderId: id,
        statusCode
      });
      res
        .status(statusCode)
        .json({ error: isDependencyUnavailable ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR" });
      return;
    }

    if (!order) {
      logEvent("orders.get.not_found", { flowId, orderId: id });
      res.status(404).json({ error: "ORDER_NOT_FOUND" });
      return;
    }

    logEvent("orders.get.found", { flowId, orderId: id, status: order.status });
    res.json(order);
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const flowId = String(res.locals.flowId ?? req.header("x-flow-id") ?? "n/a");
    if (isJsonSyntaxError(error)) {
      logEvent(
        "orders.request.invalid_json",
        {
          flowId,
          method: req.method,
          path: req.path
        },
        "WARN"
      );
      res.status(400).json({ error: "INVALID_JSON" });
      return;
    }

    const isDependencyUnavailable = isDependencyError(error);
    const statusCode = isDependencyUnavailable ? 503 : 500;
    logError("orders.request.failed", error, {
      flowId,
      method: req.method,
      path: req.path,
      statusCode
    });
    res
      .status(statusCode)
      .json({ error: isDependencyUnavailable ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR" });
  });

  return app;
}

function isJsonSyntaxError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error instanceof SyntaxError && "body" in error;
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
      "57P03",
      "UPSTREAM_UNAVAILABLE"
    ]).has(code)
  ) {
    return true;
  }

  const message = String(source.message ?? "").toLowerCase();
  return (
    message.includes("connection terminated") ||
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("getaddrinfo") ||
    message.includes("fetch failed")
  );
}
