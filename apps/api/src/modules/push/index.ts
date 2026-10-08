import { on } from "../../core/events";
import { newEventPush } from "./push.messages";

// A published event is announced in the background: it may reach many devices, the publisher
// does not wait for it. Personal notifications are sent by the modules that trigger them.
on("event.published", async ({ defer, services, event, publishedBy }) => {
  defer(async () => {
    void services.notifier
      .announceEvent({ visibility: event.visibility, publishedBy }, newEventPush(event))
      .catch((error: unknown) => console.error("Annonce push en échec", error));
  });
});

export { createNotifier } from "./notifier";
export { cancelledPush, promotedPush, reminderPush } from "./push.messages";
export { createPushRouter } from "./push.routes";
