import { Pool } from "pg";
import type { OrderStatus } from "@p2p/contracts";

export type OrderRecord = {
  id: number;
  sku: string;
  quantity: number;
  status: OrderStatus;
  reason: string | null;
  createdAt: string;
};

export class OrdersRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async createOrder(input: {
    sku: string;
    quantity: number;
    status: OrderStatus;
    reason?: string;
  }): Promise<OrderRecord> {
    const result = await this.pool.query<OrderRow>(
      `
        INSERT INTO orders.orders (sku, quantity, status, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING id, sku, quantity, status, reason, created_at;
      `,
      [input.sku, input.quantity, input.status, input.reason ?? null]
    );
    const row = result.rows[0];
    const order = row ? mapOrderRow(row) : null;

    if (!order) {
      throw new Error("Order was inserted but not found");
    }

    return order;
  }

  async getOrderById(id: number): Promise<OrderRecord | null> {
    const result = await this.pool.query<OrderRow>(
      `
        SELECT id, sku, quantity, status, reason, created_at
        FROM orders.orders
        WHERE id = $1;
      `,
      [id]
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapOrderRow(row);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export type OrdersRepositoryPort = Pick<
  OrdersRepository,
  "createOrder" | "getOrderById"
>;

type OrderRow = {
  id: number;
  sku: string;
  quantity: number;
  status: OrderStatus;
  reason: string | null;
  created_at: Date | string;
};

function mapOrderRow(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    sku: row.sku,
    quantity: row.quantity,
    status: row.status,
    reason: row.reason,
    createdAt: toIsoString(row.created_at)
  };
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}
