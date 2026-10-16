import type { TaskPriority } from "@bde/shared";
import type { TaskRef } from "../../core/events";
import type { DiscordEmbed, DiscordMessage } from "../../lib/discord";

// Brand colours of the site (globals.css), as Discord wants them: an RGB integer.
const COLORS = {
  event: 0x244ecc,
  application: 0xbc3181,
  task: 0x244ecc,
  done: 0x2f9e62,
  dueSoon: 0xe8a33a,
  late: 0xd64545,
} as const;

const PRIORITY: Record<TaskPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "🔴 Haute",
};

/** Texts typed by people never format nor break the message (`*`, `_`, `|`, links…). */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>#[\]()-])/g, "\\$1").replace(/@/g, "@\u200b");
}

export function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Discord shows `<t:…>` in each reader's own time zone and language. */
const when = (date: Date, style: "F" | "D" | "R" | "t") =>
  `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
/** A date column (« 2026-10-31 »), as noon in Paris, shown as a day. */
const day = (isoDay: string) => when(new Date(`${isoDay}T12:00:00+02:00`), "D");

type Site = { webOrigin: string };

const absolute = (site: Site, path: string) => new URL(path, site.webOrigin).toString();

function footer(site: Site) {
  return { text: "BDE Mingo", icon_url: absolute(site, "/site/logo-bde-mingo-trim.png") };
}

const boardName = (task: TaskRef) => (task.pole ? `Pôle ${task.pole.name}` : "Bureau");
const boardPath = (task: TaskRef) =>
  task.pole ? `/tasks?pole=${task.pole.id}` : "/tasks?scope=board";

export function eventPublishedMessage(
  site: Site,
  event: {
    slug: string;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    posterUrl: string | null;
    pole: { name: string };
  },
  roleId: string | undefined,
): DiscordMessage {
  const url = absolute(site, `/events/${event.slug}`);
  const poster = event.posterUrl ? absolute(site, event.posterUrl) : null;
  const embed: DiscordEmbed = {
    color: COLORS.event,
    author: { name: `Nouvel événement · Pôle ${event.pole.name}` },
    title: truncate(event.title, 256),
    url,
    ...(event.description.trim()
      ? { description: escapeMarkdown(truncate(event.description, 350)) }
      : {}),
    fields: [
      {
        name: "📅 Quand",
        value: `${when(event.startsAt, "F")}\n${when(event.startsAt, "R")}`,
        inline: true,
      },
      { name: "⏱️ Fin", value: when(event.endsAt, "t"), inline: true },
      ...(event.location.trim()
        ? [{ name: "📍 Lieu", value: escapeMarkdown(truncate(event.location, 200)), inline: true }]
        : []),
    ],
    ...(poster?.startsWith("http") ? { image: { url: poster } } : {}),
    footer: footer(site),
    timestamp: new Date().toISOString(),
  };
  return {
    ...(roleId ? { content: `<@&${roleId}> un nouvel événement vient d'être publié 🎉` } : {}),
    embeds: [embed],
    buttons: [{ label: "Voir l'événement et s'inscrire", url, emoji: "🎟️" }],
    ...(roleId ? { pingRoleIds: [roleId] } : {}),
  };
}

export function applicationMessage(
  site: Site,
  application: { candidate: string; promo: string | null; wishes: string[] },
): DiscordMessage {
  const ranked =
    application.wishes.length > 1
      ? application.wishes.map((w, i) => `**${i + 1}.** ${escapeMarkdown(w)}`).join("\n")
      : escapeMarkdown(application.wishes[0] ?? "—");
  return {
    embeds: [
      {
        color: COLORS.application,
        author: { name: "Recrutement" },
        title: "📝 Nouvelle candidature",
        description: `**${escapeMarkdown(application.candidate)}**${
          application.promo ? ` · ${escapeMarkdown(application.promo)}` : ""
        } souhaite rejoindre le BDE.`,
        fields: [{ name: application.wishes.length > 1 ? "Vœux" : "Pôle souhaité", value: ranked }],
        footer: footer(site),
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [
      {
        label: "Lire la candidature",
        url: absolute(site, "/manage/applications?status=new"),
        emoji: "📂",
      },
    ],
  };
}

function taskFields(task: TaskRef) {
  return [
    { name: "Priorité", value: PRIORITY[task.priority], inline: true },
    { name: "Délai", value: task.dueOn ? day(task.dueOn) : "Sans délai", inline: true },
    {
      name: "Assignée à",
      value: task.assignees.length > 0 ? escapeMarkdown(task.assignees.join(", ")) : "Personne",
      inline: true,
    },
  ];
}

export function taskCreatedMessage(site: Site, task: TaskRef, by: string): DiscordMessage {
  const url = absolute(site, `/tasks/${task.id}`);
  return {
    embeds: [
      {
        color: COLORS.task,
        author: { name: `${boardName(task)} · Nouvelle tâche` },
        title: `📌 ${truncate(task.title, 240)}`,
        url,
        fields: taskFields(task),
        footer: { ...footer(site), text: `Créée par ${by} · BDE Mingo` },
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [{ label: "Ouvrir la tâche", url, emoji: "🗂️" }],
  };
}

export function taskCompletedMessage(site: Site, task: TaskRef, by: string): DiscordMessage {
  const url = absolute(site, `/tasks/${task.id}`);
  return {
    embeds: [
      {
        color: COLORS.done,
        author: { name: `${boardName(task)} · Tâche terminée` },
        title: `✅ ${truncate(task.title, 240)}`,
        url,
        description: `Passée en « Fait » par **${escapeMarkdown(by)}**. Bravo !`,
        footer: footer(site),
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [{ label: "Voir la tâche", url, emoji: "🗂️" }],
  };
}

/** One line per task, linked, at most `max` lines (« … et 3 autres »). */
function taskList(site: Site, tasks: TaskRef[], detail: (t: TaskRef) => string, max = 15) {
  const lines = tasks.slice(0, max).map((t) => {
    const title = escapeMarkdown(truncate(t.title, 80));
    return `• [${title}](${absolute(site, `/tasks/${t.id}`)}) — ${detail(t)}`;
  });
  const more = tasks.length - max;
  return [...lines, ...(more > 0 ? [`… et ${more} autre${more > 1 ? "s" : ""}`] : [])].join("\n");
}

const assigneesOf = (t: TaskRef) =>
  t.assignees.length > 0 ? escapeMarkdown(t.assignees.join(", ")) : "*personne*";

/** The tasks of one board due tomorrow, in a single message. */
export function tasksDueTomorrowMessage(site: Site, tasks: TaskRef[]): DiscordMessage | null {
  const first = tasks[0];
  if (!first) return null;
  return {
    embeds: [
      {
        color: COLORS.dueSoon,
        author: { name: boardName(first) },
        title: `⏰ À rendre demain (${tasks.length})`,
        description: taskList(site, tasks, assigneesOf),
        footer: footer(site),
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [{ label: "Voir le tableau", url: absolute(site, boardPath(first)), emoji: "📋" }],
  };
}

/** The daily recap of one board's tasks past their deadline. */
export function lateTasksMessage(site: Site, tasks: TaskRef[]): DiscordMessage | null {
  const first = tasks[0];
  if (!first) return null;
  return {
    embeds: [
      {
        color: COLORS.late,
        author: { name: boardName(first) },
        title: `⚠️ Tâches en retard (${tasks.length})`,
        description: taskList(
          site,
          tasks,
          (t) => `${t.dueOn ? `depuis ${day(t.dueOn)}` : ""} · ${assigneesOf(t)}`,
        ),
        footer: footer(site),
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [{ label: "Voir le tableau", url: absolute(site, boardPath(first)), emoji: "📋" }],
  };
}
