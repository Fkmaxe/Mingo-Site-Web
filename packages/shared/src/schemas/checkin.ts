import { z } from "zod";
import { ATTENDANCE_KINDS } from "../enums";

export const CheckinInput = z
  .union([
    z.object({ qrToken: z.string().min(1, "QR code vide").max(200) }),
    z.object({ userId: z.uuid("Participant invalide") }),
  ])
  .meta({ id: "CheckinInput" });
export type CheckinInput = z.infer<typeof CheckinInput>;

export const CheckinDto = z
  .object({
    attendanceId: z.uuid(),
    kind: z.enum(ATTENDANCE_KINDS),
    checkedInAt: z.iso.datetime(),
    user: z.object({ id: z.uuid(), name: z.string(), promo: z.string().nullable() }),
  })
  .meta({ id: "Checkin" });
export type CheckinDto = z.infer<typeof CheckinDto>;

export const CheckinSearchQuery = z.object({
  q: z.string().trim().min(2, "Tape au moins 2 lettres").max(100),
});

export const CheckinCandidateDto = z
  .object({
    registrationId: z.uuid(),
    user: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.string(),
      promo: z.string().nullable(),
    }),
    checkedInAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "CheckinCandidate" });
export type CheckinCandidateDto = z.infer<typeof CheckinCandidateDto>;

export const CheckinStatsDto = z
  .object({ confirmedCount: z.int(), checkedInCount: z.int() })
  .meta({ id: "CheckinStats" });
export type CheckinStatsDto = z.infer<typeof CheckinStatsDto>;
