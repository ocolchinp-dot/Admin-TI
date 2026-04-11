import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgSchema,
  text,
  timestamp
} from "drizzle-orm/pg-core";

const ordersSchema = pgSchema("orders");

export const orderStatusEnum = ordersSchema.enum("order_status", [
  "CONFIRMED",
  "REJECTED_OUT_OF_STOCK"
]);

export const ordersTable = ordersSchema.table(
  "orders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    status: orderStatusEnum("status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [check("orders_quantity_positive", sql`${table.quantity} > 0`)]
);
