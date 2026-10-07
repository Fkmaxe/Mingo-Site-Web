"use client";

import { SignUpInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { FormAlert, FormField } from "./form-field";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(SignUpInput) });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setError(null);
    const result = await authClient.signUp.email({ name, email, password, callbackURL: "/home" });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <FormField
        id="name"
        label="Prénom et nom"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <FormField
        id="email"
        label="Adresse email de l'école"
        type="email"
        autoComplete="email"
        placeholder="prenom.nom@myskolae.fr"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Mot de passe (10 caractères minimum)"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormField
        id="passwordConfirmation"
        label="Confirme le mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirmation?.message}
        {...register("passwordConfirmation")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
