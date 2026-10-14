import type { components } from "@/lib/api-schema";

export type Task = components["schemas"]["Task"];
export type PoleMember = components["schemas"]["PoleMember"];

/** Where a new task goes: a pole board, the bureau board, or the author's personal tasks. */
export type TaskTarget =
  | { kind: "pole"; poleId: string }
  | { kind: "board" }
  | { kind: "personal" };
