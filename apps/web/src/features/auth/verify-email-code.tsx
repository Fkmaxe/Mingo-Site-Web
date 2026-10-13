"use client";

import { ALLOWED_EMAIL_DOMAIN } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { CodeField } from "./code-field";
import { ResendVerificationButton } from "./resend-verification-button";
import { safeNextPath } from "./safe-next";

/**
 * Confirms the address with the 6-digit code of the sign-up mail; the account is then signed in
 * (autoSignInAfterVerification). Opened without an address (other device): asks for it first.
 */
export function VerifyEmailCode({
  email: initialEmail,
  next,
}: {
  email?: string | undefined;
  next?: string | undefined;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verify = () =>
    startTransition(async () => {
      setError(null);
      const response = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp });
      if (response.error) return setError(authErrorMessage(response.error));
      router.push(safeNextPath(next));
      router.refresh();
    });

  const validEmail = email.includes("@");
  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {initialEmail ? null : (
          <FormField
            id="verify-email"
            label="Adresse email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={`prenom.nom@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <CodeField value={otp} onChange={setOtp} />
        <Button type="submit" size="lg" disabled={pending || otp.length !== 6 || !validEmail}>
          {pending ? "Vérification…" : "Confirmer mon adresse"}
        </Button>
      </form>
      {validEmail ? <ResendVerificationButton email={email.trim()} /> : null}
    </div>
  );
}
