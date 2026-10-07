import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ShellProps = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: (aria: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
};

/** Label, control, hint and error, wired for accessibility. */
export function FieldShell({ id, label, error, hint, children }: ShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormFieldProps = React.ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function FormField({ id, label, error, hint, ...inputProps }: FormFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(aria) => <Input {...aria} {...inputProps} />}
    </FieldShell>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md bg-destructive/10 p-3 text-destructive text-sm"
          : "rounded-md bg-success/10 p-3 text-sm text-success"
      }
    >
      {children}
    </p>
  );
}
