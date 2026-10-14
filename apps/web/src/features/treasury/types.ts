import type { components } from "@/lib/api-schema";

export type Transaction = components["schemas"]["Transaction"];
export type TransactionDetail = components["schemas"]["TransactionDetail"];
export type Attachment = components["schemas"]["TreasuryAttachment"];
export type TreasurySummary = components["schemas"]["TreasurySummary"];
export type EventBudget = components["schemas"]["EventBudget"];

/** A BDE member who can be chosen as the initiator of an entry. */
export type Initiator = { id: string; name: string; avatarUrl: string | null; detail: string };
