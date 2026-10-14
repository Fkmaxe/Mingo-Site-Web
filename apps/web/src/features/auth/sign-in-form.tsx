"use client";

import { SignInInput } from "@bde/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormAlert } from "@/components/form-field";
import { SchoolEmailField } from "@/components/school-email-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { PasswordField } from "./password-field";
import { authHref, safeNextPath } from "./safe-next";

export function SignInForm({ next }: { next?: string | undefined }) {
  const destination = safeNextPath(next);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(SignInInput) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signIn.email({
      ...values,
      callbackURL: destination,
    });
    if (result.error) {
      // Better Auth has just sent a new confirmation mail: show where to look for it.
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        router.push(authHref("/verify-email", next, { email: values.email, resent: "1" }));
        return;
      }
      setError(authErrorMessage(result.error));
      return;
    }
    router.push(destination);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <SchoolEmailField
            id="email"
            autoComplete="username webauthn"
            error={errors.email?.message}
            ref={field.ref}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Link
        href="/forgot-password"
        className="-my-1 self-end py-1 text-primary text-sm underline-offset-4 hover:underline"
      >
        Mot de passe oublié ?
      </Link>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
