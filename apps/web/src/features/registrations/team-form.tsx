"use client";

import { type AnswerValue, CreateTeamInput, type CustomFieldDef, JoinTeamInput } from "@bde/shared";
import { useState } from "react";
import { FormField } from "@/components/form-field";
import { AnswersForm } from "./answers-form";

export type TeamMode = "create" | "join";

type Props = {
  mode: TeamMode;
  fields: CustomFieldDef[];
  pending: boolean;
  serverErrors: Record<string, string>;
  onSubmit: (value: string, answers: Record<string, AnswerValue>) => void;
  onCancel: () => void;
};

const nameSchema = CreateTeamInput.shape.name;
const codeSchema = JoinTeamInput.shape.code;

/** Team name (create) or join code (join), then the event's questions. */
export function TeamForm({ mode, fields, pending, serverErrors, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const creating = mode === "create";
  const shownError = error ?? serverErrors[creating ? "name" : "code"];

  return (
    <div className="flex flex-col gap-4">
      <FormField
        id={creating ? "team-name" : "team-code"}
        label={creating ? "Nom de l'équipe" : "Code de l'équipe"}
        hint={creating ? "Tu en seras capitaine" : "6 caractères, donné par ton capitaine"}
        autoComplete="off"
        autoCapitalize={creating ? "sentences" : "characters"}
        className={creating ? undefined : "font-mono uppercase tracking-widest"}
        maxLength={creating ? 40 : 6}
        value={value}
        error={shownError}
        onChange={(e) => setValue(e.target.value)}
      />
      <AnswersForm
        fields={fields}
        submitLabel={creating ? "Créer l'équipe" : "Rejoindre l'équipe"}
        pending={pending}
        serverErrors={serverErrors}
        onCancel={onCancel}
        onSubmit={(answers) => {
          const parsed = (creating ? nameSchema : codeSchema).safeParse(value);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Valeur invalide");
            return;
          }
          setError(null);
          onSubmit(parsed.data, answers);
        }}
      />
    </div>
  );
}
