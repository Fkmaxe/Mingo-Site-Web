"use client";

import { Eye, EyeOff } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { FieldShell } from "@/components/form-field";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

/** Password input with a show/hide toggle: typing on a phone keyboard is error-prone. */
export function PasswordField({ id, label, error, hint, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(aria) => (
        <div className="relative">
          <Input
            {...aria}
            {...inputProps}
            type={visible ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {visible ? (
              <EyeOff aria-hidden className="size-5" />
            ) : (
              <Eye aria-hidden className="size-5" />
            )}
          </button>
        </div>
      )}
    </FieldShell>
  );
}
