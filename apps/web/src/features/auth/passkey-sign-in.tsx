"use client";

import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./auth-errors";
import { safeNextPath } from "./safe-next";

/**
 * "Se connecter avec une passkey". Where the browser supports it, the passkeys of this device are
 * also suggested in the email field (WebAuthn conditional UI): one tap, no typing.
 */
export function PasskeySignIn({ next }: { next?: string | undefined }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = () => {
    router.push(safeNextPath(next));
    router.refresh();
  };

  // Latest done() for the autofill ceremony started once on mount.
  const doneRef = useRef(done);
  doneRef.current = done;

  // Browser capability only (no data from the API): WebAuthn exists on this device. Runs once:
  // a second autofill ceremony would abort the button's one and replace its challenge cookie.
  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;
    setSupported(true);
    void PublicKeyCredential.isConditionalMediationAvailable?.().then(async (available) => {
      if (!available) return;
      const response = await authClient.signIn.passkey({ autoFill: true });
      if (response && !response.error) doneRef.current();
    });
  }, []);

  if (!supported) return null;
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const response = await authClient.signIn.passkey();
            if (response?.error) {
              console.warn("passkey sign-in failed", response.error);
              setError(authErrorMessage(response.error));
              return;
            }
            done();
          })
        }
      >
        <Fingerprint aria-hidden />
        Se connecter avec une passkey
      </Button>
    </div>
  );
}
