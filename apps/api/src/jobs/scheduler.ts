import { type JobDeps, runReminders } from "./reminders";

const REMINDERS_EVERY_MS = 15 * 60 * 1000;

/**
 * In-process scheduler (one API instance). Jobs are idempotent, so a restart or an overlap
 * only delays them. Returns a function that stops it.
 */
export function startScheduler(deps: JobDeps): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await runReminders(deps);
      if (sent.participants + sent.staff > 0) {
        console.log(`Rappels envoyés : ${sent.participants} participant(s), ${sent.staff} staff`);
      }
    } catch (error) {
      console.error("Job des rappels en échec", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, REMINDERS_EVERY_MS);
  return () => clearInterval(timer);
}
