"use client";

import { ALLOWED_EMAIL_DOMAIN, ForgotPasswordInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";

/** `/verify-email` opened without an address (old link, other device): ask for it. */
export function ResendVerificationForm({ callbackURL }: { callbackURL: string }) {
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(ForgotPasswordInput) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setResult(null);
    const response = await authClient.sendVerificationEmail({ email, callbackURL });
    if (response.error) {
      setResult({ tone: "error", text: authErrorMessage(response.error) });
      return;
    }
    setResult({ tone: "success", text: `Mail renvoyé à ${email}.` });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {result ? <FormAlert tone={result.tone}>{result.text}</FormAlert> : null}
      <FormField
        id="email"
        label="Pas reçu ? Indique ton adresse"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder={`prenom.nom@${ALLOWED_EMAIL_DOMAIN}`}
        error={errors.email?.message}
        {...register("email")}
      />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        disabled={isSubmitting || (isSubmitSuccessful && result?.tone === "success")}
      >
        {isSubmitting ? "Envoi…" : "Renvoyer le mail"}
      </Button>
    </form>
  );
}
