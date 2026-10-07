import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";

type Person = { name: string; email: string };

export function acceptedEmail(person: Person, poleName: string, url: string): Mail {
  return buildMail({
    to: person.email,
    subject: "Bienvenue au BDE Mingo !",
    title: "Ta candidature est acceptée",
    paragraphs: [
      `Félicitations ${person.name} : tu rejoins le pôle ${poleName} du BDE Mingo !`,
      "Tu as maintenant accès aux tâches, aux réunions et au staff des événements dans l'appli.",
    ],
    action: { label: "Ouvrir l'appli", url },
  });
}

export function rejectedEmail(person: Person, url: string): Mail {
  return buildMail({
    to: person.email,
    subject: "Ta candidature au BDE Mingo",
    title: "Merci pour ta candidature",
    paragraphs: [
      `Salut ${person.name}, merci de t'être proposé·e pour rejoindre le BDE.`,
      "Nous ne pouvons pas donner suite cette fois-ci, mais tu restes le bienvenu à tous nos événements !",
    ],
    action: { label: "Voir les événements", url },
  });
}
