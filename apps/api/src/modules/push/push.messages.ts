import { parisDateTime, parisTime } from "../../core/time";
import type { PushMessage } from "../../lib/push";

type EventInfo = { title: string; slug: string; startsAt: Date; location: string };

// Short texts: a notification shows about two lines on a phone. Paths, the web adds the origin.

export function promotedPush(event: EventInfo, registrationId: string): PushMessage {
  return {
    title: "Une place s'est libérée 🎉",
    body: `Tu es inscrit·e à « ${event.title} ». Ton billet est prêt.`,
    url: `/tickets/${registrationId}`,
    tag: `registration-${registrationId}`,
  };
}

export function reminderPush(event: EventInfo, registrationId: string): PushMessage {
  return {
    title: `C'est demain : ${event.title}`,
    body: `${parisTime(event.startsAt)} · ${event.location}. Ton billet est dans l'appli.`,
    url: `/tickets/${registrationId}`,
    tag: `reminder-${registrationId}`,
  };
}

export function cancelledPush(event: EventInfo): PushMessage {
  return {
    title: "Événement annulé",
    body: `« ${event.title} » n'aura pas lieu. Désolé !`,
    url: `/events/${event.slug}`,
    tag: `event-${event.slug}`,
  };
}

export function newEventPush(event: EventInfo): PushMessage {
  return {
    title: `Nouvel événement : ${event.title}`,
    body: `${parisDateTime(event.startsAt)} · ${event.location}`,
    url: `/events/${event.slug}`,
    tag: `event-${event.slug}`,
  };
}
