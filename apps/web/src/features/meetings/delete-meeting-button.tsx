"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteMeetingAction } from "./actions";

export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  return confirming ? (
    <div className="flex gap-2">
      <Button
        variant="destructive"
        className="flex-1"
        disabled={pending}
        onClick={() => startTransition(async () => void (await deleteMeetingAction(meetingId)))}
      >
        Confirmer la suppression
      </Button>
      <Button variant="outline" onClick={() => setConfirming(false)}>
        Retour
      </Button>
    </div>
  ) : (
    <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
      Supprimer la réunion
    </Button>
  );
}
