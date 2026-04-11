import { reserveRequestSchema, reserveResponseSchema } from "@p2p/contracts";
import { logError, logEvent } from "./logger";

export type InventoryReservationResult =
  | { type: "reserved"; remaining: number }
  | { type: "out_of_stock" };

export interface InventoryClient {
  reserve(
    input: { sku: string; quantity: number },
    context?: { flowId?: string }
  ): Promise<InventoryReservationResult>;
}

export class HttpInventoryClient implements InventoryClient {
  constructor(private readonly baseUrl: string) {}

  async reserve(
    input: {
      sku: string;
      quantity: number;
    },
    context?: {
      flowId?: string;
    }
  ): Promise<InventoryReservationResult> {
    const flowId = context?.flowId ?? "n/a";
    const parsedRequest = reserveRequestSchema.safeParse(input);

    if (!parsedRequest.success) {
      throw new Error("Invalid reservation request");
    }

    const url = `${this.baseUrl}/inventory/reserve`;
    logEvent(
      "inventory.reserve.request",
      {
        flowId,
        url,
        payload: parsedRequest.data
      },
      "DEBUG"
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flow-id": flowId
        },
        body: JSON.stringify(parsedRequest.data)
      });
    } catch (error) {
      logError("inventory.reserve.transport_error", error, {
        flowId,
        url
      });
      throw error;
    }

    const body = await response.json().catch(() => null);

    if (response.status >= 500) {
      logEvent(
        "inventory.reserve.upstream_failure",
        { flowId, statusCode: response.status, body },
        "ERROR"
      );
      const error = new Error(
        `inventory-service unavailable (status ${response.status})`
      ) as Error & { code?: string };
      error.code = "UPSTREAM_UNAVAILABLE";
      throw error;
    }

    const parsedResponse = reserveResponseSchema.safeParse(body);

    if (!parsedResponse.success) {
      logEvent(
        "inventory.reserve.invalid_response",
        { flowId, statusCode: response.status, body },
        "WARN"
      );
      throw new Error("Invalid response from inventory-service");
    }

    if (response.status === 200 && parsedResponse.data.reserved) {
      logEvent("inventory.reserve.success", {
        flowId,
        statusCode: response.status,
        remaining: parsedResponse.data.remaining
      });
      return {
        type: "reserved",
        remaining: parsedResponse.data.remaining
      };
    }

    if (response.status === 409 && !parsedResponse.data.reserved) {
      logEvent("inventory.reserve.out_of_stock", { flowId, statusCode: response.status });
      return {
        type: "out_of_stock"
      };
    }

    logEvent(
      "inventory.reserve.unexpected_status",
      { flowId, statusCode: response.status, body },
      "WARN"
    );
    throw new Error(`Unexpected status code from inventory-service: ${response.status}`);
  }
}
