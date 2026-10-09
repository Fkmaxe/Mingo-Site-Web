import type { ItemCondition, ItemKind } from "@bde/shared";

export function available(quantity: number, out: number): number {
  return Math.max(quantity - out, 0);
}

/** Why an item cannot be taken out, or null when it can. */
export function checkoutRefusal(
  item: { kind: ItemKind; quantity: number },
  out: number,
  requested: number,
): string | null {
  if (item.kind === "unique") {
    if (requested !== 1) return "Un objet unique se sort en un seul exemplaire.";
    return out > 0 ? "Cet objet est déjà sorti : il faut d'abord le rendre." : null;
  }
  const left = available(item.quantity, out);
  if (requested > left) {
    return left === 0
      ? "Plus rien de disponible : tout est sorti."
      : `Seulement ${left} disponible${left > 1 ? "s" : ""}.`;
  }
  return null;
}

/** New stock after +/-; refused below zero or below what is currently out. */
export function adjustedQuantity(
  quantity: number,
  out: number,
  delta: number,
): { quantity: number } | { refusal: string } {
  const next = quantity + delta;
  if (next < 0)
    return { refusal: `Il n'y en a que ${quantity} : impossible d'en retirer ${-delta}.` };
  if (next < out) {
    return { refusal: `${out} sont sortis : la quantité ne peut pas descendre en dessous.` };
  }
  return { quantity: next };
}

export function isOverdue(dueAt: Date | null, now: Date): boolean {
  return dueAt !== null && dueAt.getTime() < now.getTime();
}

type Editable = {
  name: string;
  description: string;
  categoryId: string | null;
  condition: ItemCondition;
  locationId: string | null;
  poleId: string | null;
};

/**
 * What an edit changes, as history entries: a move and a state change get their own entry
 * (the most frequent actions, filtered on), other fields one "updated" entry with from/to.
 */
export function changesOf(
  before: Editable,
  input: { [K in keyof Editable]?: Editable[K] | undefined },
): {
  moved: { from: string | null; to: string | null } | null;
  condition: { from: ItemCondition; to: ItemCondition } | null;
  fields: Record<string, { from: unknown; to: unknown }>;
} {
  const changed = <K extends keyof Editable>(key: K) =>
    input[key] !== undefined && input[key] !== before[key];
  const fields: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of ["name", "description", "categoryId", "poleId"] as const) {
    if (changed(key)) fields[key] = { from: before[key], to: input[key] };
  }
  return {
    moved: changed("locationId") ? { from: before.locationId, to: input.locationId ?? null } : null,
    condition:
      changed("condition") && input.condition
        ? { from: before.condition, to: input.condition }
        : null,
    fields,
  };
}
