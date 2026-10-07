"use client";

import { ForgotPasswordInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(ForgotPasswordInput) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <FormAlert tone="success">
        Si un compte existe avec cette adresse, tu vas recevoir un lien pour choisir un nouveau mot
        de passe.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <FormField
        id="email"
        label="Adresse email"
        type="email"
        autoComplete="email"
        placeholder="prenom.nom@myskolae.fr"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Envoi…" : "Recevoir le lien"}
      </Button>
    </form>
  );
}
