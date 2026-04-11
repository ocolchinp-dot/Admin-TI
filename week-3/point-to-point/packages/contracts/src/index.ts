import { z } from "zod";

export const createOrderSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive()
});

export const reserveRequestSchema = createOrderSchema;

export const orderStatusSchema = z.enum([
  "CONFIRMED",
  "REJECTED_OUT_OF_STOCK"
]);

export const reserveResponseSchema = z.union([
  z.object({
    reserved: z.literal(true),
    remaining: z.number().int().nonnegative()
  }),
  z.object({
    reserved: z.literal(false),
    reason: z.literal("OUT_OF_STOCK")
  })
]);

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type ReserveRequest = z.infer<typeof reserveRequestSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type ReserveResponse = z.infer<typeof reserveResponseSchema>;
