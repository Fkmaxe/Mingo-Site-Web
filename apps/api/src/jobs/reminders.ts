import type { Services } from "../core/context";
import type { DbOrTx } from "../db/client";
import { sendRegistrationReminders } from "../modules/registrations";
import { sendStaffReminders } from "../modules/staff";
import { sendTaskReminders } from "../modules/tasks";

export type JobDeps = { db: DbOrTx; services: Services };

/**
 * Day-before reminders to participants, staff and people on a task due tomorrow. Safe to run
 * often: each is sent once.
 */
export async function runReminders(deps: JobDeps, now: Date = new Date()) {
  const participants = await sendRegistrationReminders(deps, now);
  const staff = await sendStaffReminders(deps, now);
  const tasks = await sendTaskReminders(deps, now);
  return { participants, staff, tasks };
}
