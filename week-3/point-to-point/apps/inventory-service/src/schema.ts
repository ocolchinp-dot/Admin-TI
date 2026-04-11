import { sql } from "drizzle-orm";
import { check, integer, pgSchema, text } from "drizzle-orm/pg-core";

const inventorySchema = pgSchema("inventory");

export const inventoryTable = inventorySchema.table(
  "inventory",
  {
    sku: text("sku").primaryKey(),
    stock: integer("stock").notNull()
  },
  (table) => [check("inventory_stock_non_negative", sql`${table.stock} >= 0`)]
);
