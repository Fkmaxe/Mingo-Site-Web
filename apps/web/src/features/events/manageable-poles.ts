import type { Me } from "@/lib/session";
import type { Pole } from "./types";

/** Poles the user may create events for: all for the board, their own for pole leads. */
export function manageablePoles(me: Me, poles: Pole[]): Pole[] {
  if (me.permissions.includes("poles:all")) return poles;
  const led = new Set(
    me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole.id] : [])),
  );
  return poles.filter((pole) => led.has(pole.id));
}
