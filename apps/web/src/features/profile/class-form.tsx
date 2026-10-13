"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { updateClassAction } from "./actions";

type Ref = { id: string; name: string };

export function ClassForm({
  levels,
  tracks,
  levelId,
  trackId,
}: {
  levels: Ref[];
  tracks: Ref[];
  levelId: string | null;
  trackId: string | null;
}) {
  const router = useRouter();
  const [level, setLevel] = useState(levelId ?? "");
  const [track, setTrack] = useState(trackId ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = level !== (levelId ?? "") || track !== (trackId ?? "");

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
            <NativeSelect {...aria} value={level} onChange={(e) => setLevel(e.target.value)}>
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
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      </div>
      <Button type="submit" disabled={pending || !changed} className="self-start">
        Enregistrer ma classe
      </Button>
    </form>
  );
}
