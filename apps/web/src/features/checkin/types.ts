import type { components } from "@/lib/api-schema";

export type Checkin = components["schemas"]["Checkin"];
export type CheckinCandidate = components["schemas"]["CheckinCandidate"];
export type CheckinStats = components["schemas"]["CheckinStats"];

export type ScanOutcome =
  | { tone: "success"; title: string; detail: string }
  | { tone: "warning"; title: string; detail: string }
  | { tone: "error"; title: string; detail: string };
