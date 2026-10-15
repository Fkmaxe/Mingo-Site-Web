import type { MeetingKind } from "@bde/shared";
import type { Meeting } from "./types";

export const MEETING_KIND_LABELS: Record<Exclude<MeetingKind, "pole">, string> = {
  general: "Réunion générale",
  board: "Réunion du bureau",
  leads: "Réunion bureau + responsables",
};

/** Who the meeting is for: its pole, or its kind. */
export function meetingAudience(meeting: Pick<Meeting, "kind" | "pole">): string {
  if (meeting.kind === "pole") return meeting.pole ? `Pôle ${meeting.pole.name}` : "Pôle";
  return MEETING_KIND_LABELS[meeting.kind];
}
