import type { DbOrTx } from "../../db/client";
import type { Notifier, Pusher } from "../../lib/push";
import { announceEvent, notifyUsers } from "./push.service";

export function createNotifier(db: DbOrTx, pusher: Pusher): Notifier {
  const deps = { db, services: { pusher } };
  return {
    notifyUsers: (userIds, message) => notifyUsers(deps, userIds, message),
    announceEvent: (event, message) => announceEvent(deps, event, message),
  };
}
