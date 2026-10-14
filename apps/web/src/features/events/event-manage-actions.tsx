"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { cancelEventAction, deleteEventAction, publishEventAction } from "./actions";
import type { Event } from "./types";

type Pending = "cancel" | "delete" | null;

/** Publish / cancel / delete. Destructive actions ask for a second tap instead of a dialog. */
export function EventManageActions({ event }: { event: Event }) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setResult(await action());
      setConfirming(null);
    });

  return (
    <div className="flex flex-col gap-3">
      {result && !result.ok ? <FormAlert tone="error">{result.message}</FormAlert> : null}

      {event.status === "draft" ? (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => publishEventAction(event.id))}
        >
          Publier l'événement
        </Button>
      ) : null}

      {event.status === "draft" || event.status === "published" ? (
        confirming === "cancel" ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => cancelEventAction(event.id))}
            >
              Confirmer l'annulation
            </Button>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Retour
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="lg" onClick={() => setConfirming("cancel")}>
            Annuler l'événement
          </Button>
        )
      ) : null}

      {event.status === "draft" || event.status === "cancelled" ? (
        confirming === "delete" ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => deleteEventAction(event.id))}
            >
              {event.status === "draft"
                ? "Confirmer la suppression"
                : "Supprimer : il ne sera plus visible"}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Retour
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirming("delete")}
          >
            {event.status === "draft" ? "Supprimer le brouillon" : "Supprimer l'événement"}
          </Button>
        )
      ) : null}
    </div>
  );
}
