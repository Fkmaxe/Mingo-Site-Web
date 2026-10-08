"use client";

import { useEffect, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";

const COOLDOWN_S = 60;

/**
 * Sends the confirmation mail again: for a mail that never arrived, or an account created while
 * mails were failing (signing up again with the same address sends nothing, by design).
 */
export function ResendVerificationButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Countdown before another request (the API rate-limits it as well).
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const resend = () =>
    startTransition(async () => {
      setResult(null);
      const response = await authClient.sendVerificationEmail({ email, callbackURL: "/home" });
      if (response.error) {
        setResult({ tone: "error", text: authErrorMessage(response.error) });
        return;
      }
      setResult({ tone: "success", text: `Mail renvoyé à ${email}.` });
      setLeft(COOLDOWN_S);
    });

  return (
    <div className="flex flex-col gap-3">
      {result ? <FormAlert tone={result.tone}>{result.text}</FormAlert> : null}
      <Button variant="outline" size="lg" disabled={pending || left > 0} onClick={resend}>
        {pending
          ? "Envoi…"
          : left > 0
            ? `Renvoyer le mail (${left} s)`
            : "Pas reçu ? Renvoyer le mail"}
      </Button>
    </div>
  );
}
