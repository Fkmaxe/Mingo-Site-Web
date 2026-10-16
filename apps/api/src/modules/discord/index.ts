import { on } from "../../core/events";
import {
  applicationMessage,
  eventPublishedMessage,
  taskCompletedMessage,
  taskCreatedMessage,
  tasksDueTomorrowMessage,
} from "./discord.messages";
import { byChannel, post, taskChannel } from "./discord.service";

// The site's news on the BDE's Discord server, each kind in the channel set in the .env.

on("event.published", async ({ defer, services, event }) => {
  const channel = services.discord.channels.events;
  post(
    defer,
    services,
    channel?.channelId,
    eventPublishedMessage(services, event, channel?.roleId),
  );
});

on("application.submitted", async ({ defer, services, application }) => {
  post(
    defer,
    services,
    services.discord.channels.applications,
    applicationMessage(services, application),
  );
});

on("task.created", async ({ defer, services, task, by }) => {
  post(defer, services, taskChannel(services, task), taskCreatedMessage(services, task, by));
});

on("task.completed", async ({ defer, services, task, by }) => {
  post(defer, services, taskChannel(services, task), taskCompletedMessage(services, task, by));
});

on("tasks.due_tomorrow", async ({ defer, services, tasks }) => {
  for (const [channelId, group] of byChannel(services, tasks)) {
    post(defer, services, channelId, tasksDueTomorrowMessage(services, group));
  }
});

export { postLateTaskRecaps } from "./discord.service";
