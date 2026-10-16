"use client";

import { ApplicationLinkInput, DOCUMENT_FILE_MAX_BYTES } from "@bde/shared";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { handInFileAction, handInLinkAction } from "./actions";
import type { DocumentRequirement } from "./types";

/** What the candidate picked for an asked document. */
export type DocumentChoice = { kind: "file"; file: File } | { kind: "link"; url: string };

const ANY_FILE =
  "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

/** An error message for the choice, or null when it can be sent. */
export function choiceError(
  requirement: DocumentRequirement,
  choice: DocumentChoice | null,
): string | null {
  if (!choice) return requirement.required ? "Ce document est obligatoire" : null;
  if (choice.kind === "file") {
    if (choice.file.size > DOCUMENT_FILE_MAX_BYTES) return "10 Mo au plus";
    if (requirement.pdfOnly && choice.file.type && choice.file.type !== "application/pdf") {
      return "Envoie un PDF";
    }
    return null;
  }
  const parsed = ApplicationLinkInput.safeParse({ url: choice.url.trim() });
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Lien invalide");
}

/** Sends the choice of a document to the candidate's application. */
export function sendChoice(key: string, choice: DocumentChoice): Promise<ActionResult> {
  if (choice.kind === "link") return handInLinkAction(key, choice.url.trim());
  const form = new FormData();
  form.set("file", choice.file);
  form.set("name", choice.file.name);
  return handInFileAction(key, form);
}

/** A file input, or a link instead when the document allows one. */
export function DocumentInput({
  requirement,
  value,
  onChange,
  error,
}: {
  requirement: DocumentRequirement;
  value: DocumentChoice | null;
  onChange: (choice: DocumentChoice | null) => void;
  error?: string | null | undefined;
}) {
  const id = `document-${requirement.key}`;
  const asLink = value?.kind === "link";
  const describedBy = [
    requirement.description ? `${id}-description` : "",
    error ? `${id}-error` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border p-3">
      <legend className="px-1 font-medium text-sm">
        {requirement.label}
        {requirement.required ? " *" : ""}
      </legend>
      {requirement.description ? (
        <p id={`${id}-description`} className="whitespace-pre-line text-muted-foreground text-sm">
          {requirement.description}
        </p>
      ) : null}
      {requirement.allowLink ? (
        <div className="flex gap-4 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`${id}-kind`}
              className="size-5 accent-primary"
              checked={!asLink}
              onChange={() => onChange(null)}
            />
            Un fichier
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`${id}-kind`}
              className="size-5 accent-primary"
              checked={asLink}
              onChange={() => onChange({ kind: "link", url: "" })}
            />
            Un lien
          </label>
        </div>
      ) : null}
      {asLink ? (
        <Input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          aria-label={`${requirement.label} : lien`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          value={value.url}
          onChange={(e) => onChange({ kind: "link", url: e.target.value })}
        />
      ) : (
        <input
          id={id}
          type="file"
          aria-label={`${requirement.label} : fichier`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          accept={requirement.pdfOnly ? "application/pdf,.pdf" : ANY_FILE}
          className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:bg-card file:px-4 file:font-medium"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onChange(file ? { kind: "file", file } : null);
          }}
        />
      )}
      <p className="text-muted-foreground text-xs">
        {requirement.pdfOnly ? "PDF" : "Photo, PDF, Word, Excel, PowerPoint, texte ou CSV"} · 10 Mo
        max
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
