CREATE SCHEMA IF NOT EXISTS "inventory";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "orders";
--> statement-breakpoint
CREATE TYPE "orders"."order_status" AS ENUM('CONFIRMED', 'REJECTED_OUT_OF_STOCK');--> statement-breakpoint
CREATE TABLE "inventory"."inventory" (
	"sku" text PRIMARY KEY NOT NULL,
	"stock" integer NOT NULL,
	CONSTRAINT "inventory_stock_non_negative" CHECK ("inventory"."inventory"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders"."orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders"."orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "orders"."order_status" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quantity_positive" CHECK ("orders"."orders"."quantity" > 0)
);
