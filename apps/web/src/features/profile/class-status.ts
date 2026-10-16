import type { Me } from "@/lib/session";

/** The class is filled in: a label, and its number once a year is chosen. */
export function hasClass(me: Pick<Me, "promo" | "level" | "classNumber">): boolean {
  return Boolean(me.promo) && (me.level === null || me.classNumber !== null);
}
