"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { volunteerAction } from "./actions";
import { slotTime } from "./slot-time";
import type { StaffSlot } from "./types";

const STATUS: Record<"proposed" | "validated" | "declined", string> = {
  proposed: "Proposé·e, en attente du responsable",
  validated: "Validé·e : tu es dans le staff",
  declined: "Refusé·e par le responsable",
};

/** For BDE members: offer to staff a slot of the event. */
export function StaffVolunteerPanel({ slots }: { slots: StaffSlot[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (slots.length === 0) return null;

  const run = (slotId: string, action: "volunteer" | "withdraw") =>
    startTransition(async () => {
      const result = await volunteerAction(slotId, action);
      setError(result.ok ? null : result.message);
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-lg">Staff</h2>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <ul className="flex flex-col divide-y rounded-xl border">
        {slots.map((slot) => (
          <li key={slot.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-medium">{slot.label}</span>
                <span className="text-muted-foreground text-xs first-letter:uppercase">
                  {slotTime(slot)} · {slot.validatedCount}/{slot.capacity}
                </span>
              </div>
              {slot.mine === null ? (
                <Button size="sm" disabled={pending} onClick={() => run(slot.id, "volunteer")}>
                  Me proposer
                </Button>
              ) : slot.mine.status !== "declined" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(slot.id, "withdraw")}
                >
                  Me retirer
                </Button>
              ) : null}
            </div>
            {slot.mine ? <span className="text-sm">{STATUS[slot.mine.status]}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
