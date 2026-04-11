import { describe, expect, it } from "vitest";
import { createInventoryApp } from "./app";
import type { InventoryRepositoryPort } from "./db";

function createTestRepo(): InventoryRepositoryPort {
  const stock = new Map<string, number>();
  return {
    async seed(items) {
      for (const item of items) {
        stock.set(item.sku, item.stock);
      }
    },
    async getStock(sku) {
      return stock.get(sku) ?? null;
    },
    async reserve(sku, quantity) {
      const current = stock.get(sku);
      if (current === undefined || current < quantity) {
        return { reserved: false, reason: "OUT_OF_STOCK" };
      }
      const remaining = current - quantity;
      stock.set(sku, remaining);
      return { reserved: true, remaining };
    }
  };
}

describe("inventory reserve", () => {
  it("reserva stock y decrementa inventario", async () => {
    const repo = createTestRepo();
    repo.seed([{ sku: "SKU-1", stock: 10 }]);

    const app = createInventoryApp(repo);
    const response = await app.request("/inventory/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku: "SKU-1", quantity: 3 })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ reserved: true, remaining: 7 });
    expect(await repo.getStock("SKU-1")).toBe(7);
  });

  it("rechaza reserva cuando no hay stock suficiente", async () => {
    const repo = createTestRepo();
    repo.seed([{ sku: "SKU-2", stock: 2 }]);

    const app = createInventoryApp(repo);
    const response = await app.request("/inventory/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku: "SKU-2", quantity: 5 })
    });

    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ reserved: false, reason: "OUT_OF_STOCK" });
    expect(await repo.getStock("SKU-2")).toBe(2);
  });
});
