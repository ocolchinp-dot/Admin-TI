import { describe, expect, it } from "vitest";
import type { OrderRecord, OrdersRepositoryPort } from "./db";
import type { InventoryClient } from "./inventory-client";
import { placeOrder } from "./service";

function createTestRepo(): OrdersRepositoryPort {
  let id = 0;
  const rows = new Map<number, OrderRecord>();

  return {
    async createOrder(input) {
      id += 1;
      const record: OrderRecord = {
        id,
        sku: input.sku,
        quantity: input.quantity,
        status: input.status,
        reason: input.reason ?? null,
        createdAt: new Date().toISOString()
      };
      rows.set(id, record);
      return record;
    },
    async getOrderById(orderId) {
      return rows.get(orderId) ?? null;
    }
  };
}

describe("orders create flow", () => {
  it("crea orden CONFIRMED cuando inventory reserva stock", async () => {
    const repo = createTestRepo();
    const inventoryClient: InventoryClient = {
      reserve: async () => ({ type: "reserved", remaining: 7 })
    };

    const result = await placeOrder(repo, inventoryClient, {
      sku: "SKU-1",
      quantity: 3
    });

    expect(result.statusCode).toBe(201);
    expect(result.order.status).toBe("CONFIRMED");

    const persisted = await repo.getOrderById(result.order.id);
    expect(persisted?.status).toBe("CONFIRMED");
    expect(persisted?.reason).toBeNull();
  });

  it("crea orden REJECTED_OUT_OF_STOCK cuando inventory no reserva", async () => {
    const repo = createTestRepo();
    const inventoryClient: InventoryClient = {
      reserve: async () => ({ type: "out_of_stock" })
    };

    const result = await placeOrder(repo, inventoryClient, {
      sku: "SKU-1",
      quantity: 100
    });

    expect(result.statusCode).toBe(409);
    expect(result.order.status).toBe("REJECTED_OUT_OF_STOCK");

    const persisted = await repo.getOrderById(result.order.id);
    expect(persisted?.status).toBe("REJECTED_OUT_OF_STOCK");
    expect(persisted?.reason).toBe("OUT_OF_STOCK");
  });
});
