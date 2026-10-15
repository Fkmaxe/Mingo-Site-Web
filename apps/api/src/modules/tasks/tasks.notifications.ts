import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";
import type { PushMessage } from "../../lib/push";

type Person = { name: string; email: string };
type TaskInfo = { id: string; title: string; dueOn: string | null };

/** "31/10/2026" */
const frenchDay = (day: string) => day.split("-").reverse().join("/");

export const taskPath = (taskId: string) => `/tasks/${taskId}`;

// Short push texts: a notification shows about two lines on a phone.

export function taskAssignedEmail(person: Person, task: TaskInfo, by: string, url: string): Mail {
  return buildMail({
    to: person.email,
    subject: `Nouvelle tâche : ${task.title}`,
    title: "On compte sur toi !",
    paragraphs: [
      `Salut ${person.name}, ${by} t'a assigné·e à la tâche « ${task.title} ».`,
      task.dueOn ? `À faire avant le ${frenchDay(task.dueOn)}.` : "Pas de délai fixé.",
    ],
    action: { label: "Voir la tâche", url },
  });
}

export function taskAssignedPush(task: TaskInfo, by: string): PushMessage {
  return {
    title: `Nouvelle tâche : ${task.title}`,
    body: `${by} te l'a assignée${task.dueOn ? `, avant le ${frenchDay(task.dueOn)}` : ""}.`,
    url: taskPath(task.id),
    tag: `task-${task.id}`,
  };
}

export function taskDueEmail(person: Person, task: TaskInfo, url: string): Mail {
  return buildMail({
    to: person.email,
    subject: `C'est pour demain : ${task.title}`,
    title: "Rappel : délai demain",
    paragraphs: [
      `Salut ${person.name}, la tâche « ${task.title} » est à faire avant demain${
        task.dueOn ? ` (${frenchDay(task.dueOn)})` : ""
      }.`,
      "Déjà faite ? Pense à la passer en « Fait » dans l'appli.",
    ],
    action: { label: "Voir la tâche", url },
  });
}

export function taskDuePush(task: TaskInfo): PushMessage {
  return {
    title: `Délai demain : ${task.title}`,
    body: "Déjà faite ? Passe-la en « Fait ».",
    url: taskPath(task.id),
    tag: `task-due-${task.id}`,
  };
}
