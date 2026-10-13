"use client";

import type * as React from "react";
import { FormField } from "@/components/form-field";

/** 6-digit code from the mail: numeric keyboard, filled by the phone's code suggestion. */
export function CodeField({
  id = "otp",
  value,
  onChange,
  error,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  return (
    <FormField
      id={id}
      label="Code reçu par mail"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="123456"
      className="text-center font-mono text-2xl tracking-[0.5em]"
      value={value}
      error={error}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
      }
    />
  );
}
