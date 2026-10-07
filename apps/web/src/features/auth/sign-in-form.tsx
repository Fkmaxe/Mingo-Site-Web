"use client";

import { SignInInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { FormAlert, FormField } from "./form-field";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(SignInInput) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signIn.email({
      ...values,
      callbackURL: "/home",
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    router.push("/home");
    router.refresh();
  });

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
      <FormField
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Link
        href="/forgot-password"
        className="self-end text-primary text-sm underline-offset-4 hover:underline"
      >
        Mot de passe oublié ?
      </Link>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
