import type { InventoryAction } from "@bde/shared";
import type { ItemCondition } from "./types";

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: "Neuf",
  good: "Bon état",
  worn: "Usé",
  damaged: "Abîmé",
  broken: "HS",
};

/** Badge tone of each state (theme tokens only). */
export const CONDITION_TONES: Record<ItemCondition, string> = {
  new: "bg-success/15 text-success",
  good: "bg-success/15 text-success",
  worn: "bg-warning/15 text-warning",
  damaged: "bg-warning/15 text-warning",
  broken: "bg-destructive/15 text-destructive",
};

export const ACTION_LABELS: Record<InventoryAction, string> = {
  created: "Ajouté",
  updated: "Modifié",
  moved: "Déplacé",
  condition_changed: "État changé",
  quantity_adjusted: "Stock ajusté",
  photo_changed: "Photo",
  checked_out: "Sorti",
  returned: "Rendu",
  archived: "Archivé",
  restored: "Restauré",
};

const FIELD_LABELS: Record<string, string> = {
  name: "nom",
  description: "description",
  category: "catégorie",
  poleId: "pôle",
};

const isCondition = (v: unknown): v is ItemCondition =>
  typeof v === "string" && v in CONDITION_LABELS;
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** One readable line for a history entry. */
export function describeMovement(action: InventoryAction, d: Record<string, unknown>): string {
  switch (action) {
    case "created":
      return d.kind === "stock" ? `Stock de ${text(d.quantity)}` : "Nouvel objet";
    case "moved":
      return `${text(d.from)} → ${text(d.to)}`;
    case "condition_changed":
      return `${isCondition(d.from) ? CONDITION_LABELS[d.from] : "?"} → ${isCondition(d.to) ? CONDITION_LABELS[d.to] : "?"}`;
    case "quantity_adjusted": {
      const delta = Number(d.delta);
      return `${delta > 0 ? "+" : ""}${delta} (${text(d.from)} → ${text(d.to)})`;
    }
    case "checked_out":
      return [
        `${Number(d.quantity) > 1 ? `${text(d.quantity)} × ` : ""}chez ${text(d.holder)}`,
        d.event ? `pour ${text(d.event)}` : null,
      ]
        .filter(Boolean)
        .join(" ");
    case "returned":
      return `par ${text(d.holder)}${isCondition(d.condition) ? `, ${CONDITION_LABELS[d.condition].toLowerCase()}` : ""}`;
    case "photo_changed":
      return `Photo ${text(d.photo)}`;
    case "updated":
      return Object.keys(d)
        .map((k) => FIELD_LABELS[k] ?? k)
        .join(", ");
    default:
      return "";
  }
}
