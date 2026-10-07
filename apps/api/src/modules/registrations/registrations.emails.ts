import { parisDateTime } from "../../core/time";
import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";

type Person = { name: string; email: string };
type EventInfo = { title: string; slug: string; startsAt: Date; location: string };

const when = (event: EventInfo) => `${parisDateTime(event.startsAt)} · ${event.location}`;

export function confirmedEmail(person: Person, event: EventInfo, ticketUrl: string): Mail {
  return buildMail({
    to: person.email,
    subject: `Inscription confirmée : ${event.title}`,
    title: "C'est noté !",
    paragraphs: [
      `Salut ${person.name}, ton inscription à « ${event.title} » est confirmée.`,
      when(event),
      "Ton billet QR est dans l'appli : montre-le à l'entrée.",
    ],
    action: { label: "Voir mon billet", url: ticketUrl },
  });
}

export function waitlistedEmail(
  person: Person,
  event: EventInfo,
  position: number,
  eventUrl: string,
): Mail {
  return buildMail({
    to: person.email,
    subject: `Liste d'attente : ${event.title}`,
    title: "Tu es sur liste d'attente",
    paragraphs: [
      `Salut ${person.name}, « ${event.title} » est complet : tu es en position ${position} sur la liste d'attente.`,
      "Si une place se libère, tu passes automatiquement inscrit·e et on te prévient par mail.",
    ],
    action: { label: "Voir l'événement", url: eventUrl },
  });
}

export function promotedEmail(person: Person, event: EventInfo, ticketUrl: string): Mail {
  return buildMail({
    to: person.email,
    subject: `Une place s'est libérée : ${event.title}`,
    title: "Tu as une place !",
    paragraphs: [
      `Bonne nouvelle ${person.name} : une place s'est libérée pour « ${event.title} », tu es maintenant inscrit·e.`,
      when(event),
      "Si tu ne peux plus venir, désinscris-toi pour laisser la place à quelqu'un d'autre.",
    ],
    action: { label: "Voir mon billet", url: ticketUrl },
  });
}

export function eventCancelledEmail(person: Person, event: EventInfo, eventUrl: string): Mail {
  return buildMail({
    to: person.email,
    subject: `Événement annulé : ${event.title}`,
    title: "Événement annulé",
    paragraphs: [
      `Salut ${person.name}, l'événement « ${event.title} » prévu le ${parisDateTime(event.startsAt)} est annulé.`,
      "Ton inscription n'est plus valable. Désolé pour le changement de programme !",
    ],
    action: { label: "Voir les autres événements", url: eventUrl },
  });
}
