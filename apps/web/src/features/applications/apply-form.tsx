"use client";

import type { AnswerValue } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnswersForm } from "@/components/answers-form";
import { FieldShell, FormAlert } from "@/components/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { applyAction } from "./actions";
import { choiceError, type DocumentChoice, DocumentInput, sendChoice } from "./document-input";
import type { ApplicationForm } from "./types";

const RANKS = ["Premier choix", "Deuxième choix", "Troisième choix"];

/** The year's form: ranked poles, the bureau's questions, then the documents to hand in. */
export function ApplyForm({ form }: { form: ApplicationForm }) {
  const router = useRouter();
  const [wishes, setWishes] = useState<string[]>(() => Array(form.maxWishes).fill(""));
  const [documents, setDocuments] = useState<Record<string, DocumentChoice | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (answers: Record<string, AnswerValue>) => {
    const next: Record<string, string> = {};
    const chosen = wishes.filter(Boolean);
    if (!wishes[0]) next.wish0 = "Choisis un pôle";
    if (new Set(chosen).size !== chosen.length) next.wish1 = "Choisis des pôles différents";
    for (const requirement of form.documents) {
      const error = choiceError(requirement, documents[requirement.key] ?? null);
      if (error) next[`document.${requirement.key}`] = error;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setMessage("Vérifie les champs en rouge.");
      return;
    }
    startTransition(async () => {
      const result = await applyAction({ wishedPoleIds: chosen, answers });
      if (!result.ok) {
        setMessage(result.message);
        setAnswerErrors(
          Object.fromEntries(
            Object.entries(result.fieldErrors).flatMap(([path, text]) =>
              path.startsWith("answers.") ? [[path.slice("answers.".length), text]] : [],
            ),
          ),
        );
        if (result.fieldErrors.wishedPoleIds) {
          setErrors({ wish0: result.fieldErrors.wishedPoleIds });
        }
        return;
      }
      // The application exists: documents follow one by one (each request stays small).
      const failed: string[] = [];
      for (const requirement of form.documents) {
        const choice = documents[requirement.key];
        if (!choice) continue;
        const sent = await sendChoice(requirement.key, choice);
        if (!sent.ok) failed.push(`${requirement.label} : ${sent.message}`);
      }
      setMessage(
        failed.length > 0
          ? `Candidature envoyée, mais des documents n'ont pas pu partir. ${failed.join(" ")}`
          : null,
      );
      router.refresh();
    });
  };

  return (
    <AnswersForm
      fields={form.fields}
      submitLabel="Envoyer ma candidature"
      pending={pending}
      serverErrors={answerErrors}
      onSubmit={submit}
    >
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      <div className="flex flex-col gap-3">
        {wishes.map((wish, index) => (
          <FieldShell
            // biome-ignore lint/suspicious/noArrayIndexKey: one select per rank, never reordered.
            key={index}
            id={`wish-${index}`}
            label={
              form.maxWishes === 1
                ? "Le pôle qui te tente *"
                : `${RANKS[index]}${index === 0 ? " *" : " (facultatif)"}`
            }
            error={errors[`wish${index}`]}
          >
            {(aria) => (
              <NativeSelect
                {...aria}
                value={wish}
                onChange={(e) =>
                  setWishes((current) => current.map((w, i) => (i === index ? e.target.value : w)))
                }
              >
                <option value="">Choisir…</option>
                {form.recruitingPoles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FieldShell>
        ))}
      </div>
      {form.documents.length > 0 ? (
        <section aria-labelledby="documents-title" className="flex flex-col gap-3">
          <h2 id="documents-title" className="font-semibold">
            Documents à remettre
          </h2>
          {form.documents.map((requirement) => (
            <DocumentInput
              key={requirement.key}
              requirement={requirement}
              value={documents[requirement.key] ?? null}
              onChange={(choice) => setDocuments((d) => ({ ...d, [requirement.key]: choice }))}
              error={errors[`document.${requirement.key}`]}
            />
          ))}
        </section>
      ) : null}
    </AnswersForm>
  );
}
