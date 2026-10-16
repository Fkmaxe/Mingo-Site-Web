"use client";

import { useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteMeetingAction } from "./actions";

export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmButton
      className="text-destructive"
      confirmLabel="Confirmer la suppression"
      disabled={pending}
      onConfirm={() => startTransition(async () => void (await deleteMeetingAction(meetingId)))}
    >
      Supprimer la réunion
    </ConfirmButton>
  );
}
