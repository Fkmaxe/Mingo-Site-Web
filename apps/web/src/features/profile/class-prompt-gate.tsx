import type { Me } from "@/lib/session";
import { ClassPrompt } from "./class-prompt";
import { hasClass } from "./class-status";
import { listClasses } from "./queries";

/** The class prompt, for those who have none yet, once the BDE has created the classes. */
export async function ClassPromptGate({ me }: { me: Me }) {
  if (hasClass(me)) return null;
  const classes = await listClasses();
  if (classes.levels.length === 0 && classes.tracks.length === 0) return null;
  return (
    <ClassPrompt
      levels={classes.levels}
      tracks={classes.tracks}
      levelId={me.level?.id ?? null}
      trackId={me.track?.id ?? null}
      rhythm={me.rhythm}
      classNumber={me.classNumber}
      januaryIntake={me.januaryIntake}
    />
  );
}
