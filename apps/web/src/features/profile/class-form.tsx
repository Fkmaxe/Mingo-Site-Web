"use client";

import { RHYTHM_LABELS, type StudyRhythm } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { updateClassAction } from "./actions";

type Ref = { id: string; name: string };
type Level = Ref & { alternanceOnly: boolean; trackIds: string[] };

/** Year, then the programmes of that year, then initial or work-study where there is a choice. */
export function ClassForm({
  levels,
  tracks,
  levelId,
  trackId,
  rhythm,
}: {
  levels: Level[];
  tracks: Ref[];
  levelId: string | null;
  trackId: string | null;
  rhythm: StudyRhythm | null;
}) {
  const router = useRouter();
  const [level, setLevel] = useState(levelId ?? "");
  const [track, setTrack] = useState(trackId ?? "");
  const [mode, setMode] = useState<StudyRhythm | "">(rhythm ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = levels.find((l) => l.id === level) ?? null;
  const offered =
    selected && selected.trackIds.length > 0
      ? tracks.filter((t) => selected.trackIds.includes(t.id))
      : tracks;
  const alternanceOnly = selected?.alternanceOnly ?? false;
  const changed =
    level !== (levelId ?? "") ||
    track !== (trackId ?? "") ||
    (!alternanceOnly && mode !== (rhythm ?? ""));

  if (levels.length === 0 && tracks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Les classes ne sont pas encore créées par le BDE : reviens bientôt.
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateClassAction({
            levelId: level || null,
            trackId: track || null,
            rhythm: alternanceOnly ? "alternance" : mode || null,
          });
          setMessage(
            result.ok
              ? { tone: "success", text: "Classe enregistrée." }
              : { tone: "error", text: result.message },
          );
          router.refresh();
        });
      }}
    >
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="grid grid-cols-2 gap-3">
        <FieldShell id="class-level" label="Année">
          {(aria) => (
            <NativeSelect
              {...aria}
              value={level}
              onChange={(e) => {
                const next = levels.find((l) => l.id === e.target.value);
                setLevel(e.target.value);
                // A programme the new year does not offer is cleared.
                if (next && next.trackIds.length > 0 && !next.trackIds.includes(track))
                  setTrack("");
              }}
            >
              <option value="">—</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
        <FieldShell id="class-track" label="Filière">
          {(aria) => (
            <NativeSelect {...aria} value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="">—</option>
              {offered.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      </div>
      {alternanceOnly ? (
        <p className="text-muted-foreground text-sm">
          En {selected?.name}, tout le monde est en alternance.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium text-sm">Rythme</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["initial", "alternance"] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm has-checked:border-primary has-checked:bg-primary/6"
              >
                <input
                  type="radio"
                  name="rhythm"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="size-4 accent-primary"
                />
                {RHYTHM_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Button type="submit" disabled={pending || !changed} className="self-start">
        Enregistrer ma classe
      </Button>
    </form>
  );
}
