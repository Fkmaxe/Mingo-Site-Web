import { parisDateTime, parisTime } from "../../core/time";
import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";

type Person = { name: string; email: string };
type SlotInfo = { label: string; startsAt: Date; endsAt: Date };
type EventInfo = { title: string; slug: string; location: string };

const slotWhen = (slot: SlotInfo, event: EventInfo) =>
  `${slot.label} · ${parisDateTime(slot.startsAt)} – ${parisTime(slot.endsAt)} · ${event.location}`;

export function staffValidatedEmail(
  person: Person,
  slot: SlotInfo,
  event: EventInfo,
  url: string,
): Mail {
  return buildMail({
    to: person.email,
    subject: `Tu es dans le staff : ${event.title}`,
    title: "Merci pour ton aide !",
    paragraphs: [
      `Salut ${person.name}, ta place dans le staff de « ${event.title} » est validée.`,
      slotWhen(slot, event),
    ],
    action: { label: "Voir l'événement", url },
  });
}

export function staffReminderEmail(
  person: Person,
  slot: SlotInfo,
  event: EventInfo,
  url: string,
): Mail {
  return buildMail({
    to: person.email,
    subject: `Rappel staff : ${event.title}`,
    title: "Rappel : tu es dans le staff",
    paragraphs: [
      `Salut ${person.name}, petit rappel pour ton créneau staff de « ${event.title} ».`,
      slotWhen(slot, event),
      "Un empêchement ? Préviens le responsable du pôle au plus vite.",
    ],
    action: { label: "Voir l'événement", url },
  });
}
