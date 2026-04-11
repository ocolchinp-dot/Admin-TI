import type { CreateOrderRequest } from "@p2p/contracts";
import type { OrdersRepositoryPort } from "./db";
import type { InventoryClient } from "./inventory-client";

type PersistedOrder = Awaited<ReturnType<OrdersRepositoryPort["createOrder"]>>;

export async function placeOrder(
  repo: OrdersRepositoryPort,
  inventoryClient: InventoryClient,
  input: CreateOrderRequest,
  context?: { flowId?: string }
): Promise<
  | {
      statusCode: 201;
      order: PersistedOrder;
    }
  | {
      statusCode: 409;
      order: PersistedOrder;
    }
> {
  const reservation = await inventoryClient.reserve(input, context);

  if (reservation.type === "reserved") {
    return {
      statusCode: 201,
      order: await repo.createOrder({
        sku: input.sku,
        quantity: input.quantity,
        status: "CONFIRMED"
      })
    };
  }

  return {
    statusCode: 409,
    order: await repo.createOrder({
      sku: input.sku,
      quantity: input.quantity,
      status: "REJECTED_OUT_OF_STOCK",
      reason: "OUT_OF_STOCK"
    })
  };
}
