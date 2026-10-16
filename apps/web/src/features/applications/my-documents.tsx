"use client";

import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { removeDocumentAction } from "./actions";
import { choiceError, type DocumentChoice, DocumentInput, sendChoice } from "./document-input";
import type { Application } from "./types";

/** Documents of my application: hand in, replace or remove them until it is decided. */
export function MyDocuments({ application }: { application: Application }) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, DocumentChoice | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = application.status === "new" || application.status === "interview";

  const run = (key: string, action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? null : (result.message ?? "Erreur"));
      if (result.ok) setChoices((c) => ({ ...c, [key]: null }));
      router.refresh();
    });

  if (application.documentRequirements.length === 0) return null;
  return (
    <section aria-labelledby="my-documents" className="flex flex-col gap-3">
      <h2 id="my-documents" className="font-semibold">
        Mes documents
      </h2>
      {application.missingDocuments.length > 0 ? (
        <FormAlert tone="error">{`À remettre : ${application.missingDocuments.join(", ")}`}</FormAlert>
      ) : null}
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      {application.documentRequirements.map((requirement) => {
        const document = application.documents.find((d) => d.key === requirement.key);
        const choice = choices[requirement.key] ?? null;
        return (
          <div key={requirement.key} className="flex flex-col gap-2">
            {document ? (
              <div className="flex items-center gap-3 rounded-xl border p-3">
                {document.kind === "link" ? (
                  <ExternalLink aria-hidden className="size-5 shrink-0 text-primary" />
                ) : (
                  <FileText aria-hidden className="size-5 shrink-0 text-primary" />
                )}
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  <span className="font-medium">{requirement.label}</span> · {document.name}
                </a>
                {open ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Retirer « ${requirement.label} »`}
                    disabled={pending}
                    onClick={() =>
                      run(requirement.key, () => removeDocumentAction(requirement.key))
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
            ) : null}
            {open ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const error = choiceError({ ...requirement, required: true }, choice);
                  setErrors((current) => ({ ...current, [requirement.key]: error ?? "" }));
                  if (error || !choice) return;
                  run(requirement.key, () => sendChoice(requirement.key, choice));
                }}
              >
                <DocumentInput
                  requirement={requirement}
                  value={choice}
                  onChange={(next) => setChoices((c) => ({ ...c, [requirement.key]: next }))}
                  error={errors[requirement.key] || null}
                />
                <Button type="submit" variant="outline" className="self-start" disabled={pending}>
                  {document ? "Remplacer" : "Envoyer"}
                </Button>
              </form>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
