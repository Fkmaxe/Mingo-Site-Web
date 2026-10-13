"use client";

import { ALLOWED_EMAIL_DOMAIN } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { CodeField } from "./code-field";
import { safeNextPath } from "./safe-next";

/** Sign-in without password: the address, then the 6-digit code received by mail. */
export function CodeSignIn({ next }: { next?: string | undefined }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError(null);
      const response = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });
      if (response.error) return setError(authErrorMessage(response.error));
      setSentTo(email.trim());
      setOtp("");
    });

  const verify = () =>
    startTransition(async () => {
      setError(null);
      const response = await authClient.signIn.emailOtp({ email: sentTo ?? "", otp });
      if (response.error) return setError(authErrorMessage(response.error));
      router.push(safeNextPath(next));
      router.refresh();
    });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (sentTo) verify();
        else send();
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {sentTo ? (
        <>
          <p className="text-sm">
            Code envoyé à <strong className="font-semibold">{sentTo}</strong>. Il est valable 10
            minutes. Pense à regarder dans les indésirables.
          </p>
          <CodeField value={otp} onChange={setOtp} />
          <Button type="submit" size="lg" disabled={pending || otp.length !== 6}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setSentTo(null)}
            >
              Changer d'adresse
            </button>
            <button
              type="button"
              disabled={pending}
              className="text-primary underline-offset-4 hover:underline"
              onClick={send}
            >
              Renvoyer un code
            </button>
          </div>
        </>
      ) : (
        <>
          <FormField
            id="otp-email"
            label="Adresse email"
            type="email"
            inputMode="email"
            autoComplete="username webauthn"
            autoCapitalize="none"
            placeholder={`prenom.nom@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" disabled={pending || !email.includes("@")}>
            {pending ? "Envoi…" : "Recevoir un code"}
          </Button>
        </>
      )}
    </form>
  );
}
