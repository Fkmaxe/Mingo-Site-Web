"use client";

import { UpdateProfileInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { updateProfileAction } from "./actions";

export function ProfileNameForm({ firstName, lastName }: UpdateProfileInput) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: { firstName, lastName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setResult(null);
    const outcome = await updateProfileAction(values);
    setResult(outcome);
    if (!outcome.ok) {
      for (const [field, message] of Object.entries(outcome.fieldErrors)) {
        if (field === "firstName" || field === "lastName") setError(field, { message });
      }
      return;
    }
    reset(values);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {result && !result.ok ? <FormAlert tone="error">{result.message}</FormAlert> : null}
      {result?.ok ? <FormAlert tone="success">C'est enregistré.</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="profile-first-name"
          label="Prénom"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <FormField
          id="profile-last-name"
          label="Nom"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !isDirty} className="sm:self-end">
        {isSubmitting ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
