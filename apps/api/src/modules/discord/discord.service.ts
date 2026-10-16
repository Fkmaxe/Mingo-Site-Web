import type { Services } from "../../core/context";
import type { TaskRef } from "../../core/events";
import { parisDate, parisHour } from "../../core/time";
import { inTransactionWithEffects } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import type { DiscordMessage } from "../../lib/discord";
import { listLateTasks } from "../tasks";
import { lateTasksMessage } from "./discord.messages";
import { claimPost } from "./discord.repo";

/** Posts after the commit; a Discord failure is logged, never fails what was done on the site. */
export function post(
  defer: (effect: () => Promise<void>) => void,
  services: Pick<Services, "discord">,
  channelId: string | undefined,
  message: DiscordMessage | null,
) {
  const { discord } = services;
  if (!discord.enabled || !channelId || !message) return;
  defer(async () => {
    await discord.send(channelId, message).catch((error: unknown) => {
      console.error("Message Discord en échec", error);
    });
  });
}

/** The channel of a task's board: its pole's, or the bureau's. */
export function taskChannel(services: Pick<Services, "discord">, task: TaskRef) {
  const { channels } = services.discord;
  if (task.scope === "board") return channels.boardTasks;
  return task.pole ? channels.poleTasks[task.pole.slug] : undefined;
}

/** Tasks grouped by the channel of their board (boards without a channel are left out). */
export function byChannel(services: Pick<Services, "discord">, tasks: TaskRef[]) {
  const groups = new Map<string, TaskRef[]>();
  for (const task of tasks) {
    const channelId = taskChannel(services, task);
    if (channelId) groups.set(channelId, [...(groups.get(channelId) ?? []), task]);
  }
  return groups;
}

/** The recap goes out from 9:00 (Paris), not in the night. */
const RECAP_HOUR = 9;

/**
 * Daily recap of the tasks past their deadline, in the channel of each board, once a day (safe
 * to run every few minutes). Returns the number of messages.
 */
export async function postLateTaskRecaps(
  deps: { db: DbOrTx; services: Services },
  now: Date = new Date(),
): Promise<number> {
  if (!deps.services.discord.enabled || parisHour(now) < RECAP_HOUR) return 0;
  const today = parisDate(now);
  return inTransactionWithEffects(deps.db, async (tx, defer) => {
    const groups = byChannel(deps.services, await listLateTasks(tx, today));
    let posted = 0;
    for (const [channelId, tasks] of groups) {
      if (!(await claimPost(tx, `late-tasks:${today}:${channelId}`))) continue;
      post(defer, deps.services, channelId, lateTasksMessage(deps.services, tasks));
      posted += 1;
    }
    return posted;
  });
}
