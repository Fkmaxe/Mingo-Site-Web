"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setAttendanceAction } from "./actions";
import type { Meeting } from "./types";

/** Roll call: one checkbox per expected member. */
export function AttendanceList({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [attendees, setOptimistic] = useOptimistic(
    meeting.attendees,
    (current, change: { userId: string; present: boolean }) =>
      current.map((a) => (a.user.id === change.userId ? { ...a, present: change.present } : a)),
  );
  const presentCount = attendees.filter((a) => a.present).length;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">
        Présents{" "}
        <span className="font-normal text-muted-foreground">
          ({presentCount}/{attendees.length})
        </span>
      </h2>
      <ul className="flex flex-col divide-y rounded-xl border">
        {attendees.map((a) => (
          <li key={a.user.id}>
            <label className="flex min-h-11 items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={a.present}
                onChange={(e) => {
                  const present = e.target.checked;
                  startTransition(async () => {
                    setOptimistic({ userId: a.user.id, present });
                    await setAttendanceAction(meeting.id, a.user.id, present);
                    router.refresh();
                  });
                }}
              />
              <span className="flex flex-col">
                <span>{a.user.name}</span>
                {a.user.promo ? (
                  <span className="text-muted-foreground text-xs">{a.user.promo}</span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
