import type { components } from "@/lib/api-schema";

export type Item = components["schemas"]["InventoryItem"];
export type Location = components["schemas"]["InventoryLocation"];
export type Movement = components["schemas"]["InventoryMovement"];
export type Checkout = components["schemas"]["InventoryCheckout"];
export type ItemCondition = Item["condition"];
