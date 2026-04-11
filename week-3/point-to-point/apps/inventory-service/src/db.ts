import { Pool, type PoolClient } from "pg";
import type { ReserveResponse } from "@p2p/contracts";

export type InventoryItem = {
  sku: string;
  stock: number;
};

export class InventoryRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async seed(items: InventoryItem[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const statement = `
        INSERT INTO inventory.inventory (sku, stock)
        VALUES ($1, $2)
        ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;
      `;

      for (const item of items) {
        await client.query(statement, [item.sku, item.stock]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const result = await this.pool.query<{ stock: number }>(
      "SELECT stock FROM inventory.inventory WHERE sku = $1;",
      [sku]
    );
    const row = result.rows[0];

    return row?.stock ?? null;
  }

  async reserve(sku: string, quantity: number): Promise<ReserveResponse> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ stock: number }>(
        "SELECT stock FROM inventory.inventory WHERE sku = $1 FOR UPDATE;",
        [sku]
      );
      const row = result.rows[0];

      if (!row || row.stock < quantity) {
        await client.query("ROLLBACK");
        return {
          reserved: false,
          reason: "OUT_OF_STOCK"
        };
      }

      await client.query(
        "UPDATE inventory.inventory SET stock = stock - $1 WHERE sku = $2;",
        [quantity, sku]
      );

      const remaining = row.stock - quantity;
      await client.query("COMMIT");

      return {
        reserved: true,
        remaining
      };
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export type InventoryRepositoryPort = Pick<
  InventoryRepository,
  "seed" | "getStock" | "reserve"
>;

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // no-op if no active transaction
  }
}
