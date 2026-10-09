"use client";

import { ALLOWED_EMAIL_DOMAIN, composeName, PASSWORD_MIN_LENGTH, SignUpInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { PasswordField } from "./password-field";
import { authHref, safeNextPath } from "./safe-next";

export function SignUpForm({ next }: { next?: string | undefined }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(SignUpInput) });

  const onSubmit = handleSubmit(async ({ firstName, lastName, email, password }) => {
    setError(null);
    const result = await authClient.signUp.email({
      name: composeName(firstName, lastName),
      firstName,
      lastName,
      email,
      password,
      // The confirmation link signs the user in and brings them back where they started.
      callbackURL: safeNextPath(next),
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    router.push(authHref("/verify-email", next, { email }));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="Prénom"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <FormField
          id="lastName"
          label="Nom"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      <FormField
        id="email"
        label="Adresse email de l'école"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder={`prenom.nom@${ALLOWED_EMAIL_DOMAIN}`}
        hint={`Seules les adresses @${ALLOWED_EMAIL_DOMAIN} sont acceptées.`}
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="new-password"
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordField
        id="passwordConfirmation"
        label="Confirme le mot de passe"
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
