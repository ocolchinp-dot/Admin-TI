import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./apps/inventory-service/src/schema.ts",
    "./apps/orders-service/src/schema.ts"
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://p2p:p2p@localhost:5432/p2p"
  },
  verbose: true,
  strict: true
});
