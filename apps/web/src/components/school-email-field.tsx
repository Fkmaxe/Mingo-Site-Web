"use client";

import { ALLOWED_EMAIL_DOMAIN, emailLocalPart, schoolEmail } from "@bde/shared";
import type * as React from "react";
import { useState } from "react";
import { FieldShell } from "@/components/form-field";
import { cn } from "@/lib/utils";

type SchoolEmailFieldProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  id: string;
  label?: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** The full address ("j.dupont@myskolae.fr"), or "" while nothing is typed. */
  value: string | undefined;
  onChange: (email: string) => void;
};

/**
 * School address field: only the identifier is typed, the domain is shown but fixed.
 * Someone who types or pastes the full address anyway keeps only its identifier: what follows
 * "@" stays visible while typing (so the next keys do not end up in the identifier) and is
 * removed when leaving the field.
 */
export function SchoolEmailField({
  id,
  label = "Adresse email de l'école",
  error,
  hint = "Initiale du prénom, un point, puis le nom de famille.",
  value,
  onChange,
  onBlur,
  className,
  ...inputProps
}: SchoolEmailFieldProps) {
  const local = emailLocalPart(value ?? "");
  const [draft, setDraft] = useState(local);
  // The parent may reset the value (form reset): the draft only wins while it matches it.
  const shown = emailLocalPart(draft).toLowerCase() === local.toLowerCase() ? draft : local;

  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(aria) => (
        <div
          className={cn(
            "flex h-11 w-full min-w-0 overflow-hidden rounded-xl border border-input bg-card transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20",
            className,
          )}
        >
          <input
            {...aria}
            aria-describedby={[`${id}-domain`, aria["aria-describedby"]].filter(Boolean).join(" ")}
            {...inputProps}
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="j.dupont"
            value={shown}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(schoolEmail(e.target.value));
            }}
            onBlur={(e) => {
              setDraft(local);
              onBlur?.(e);
            }}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span
            id={`${id}-domain`}
            className="flex shrink-0 select-none items-center border-input border-l bg-muted px-3 text-muted-foreground text-sm"
          >
            @{ALLOWED_EMAIL_DOMAIN}
          </span>
        </div>
      )}
    </FieldShell>
  );
}
