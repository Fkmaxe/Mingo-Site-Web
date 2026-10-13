"use client";

import { Fingerprint, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth-client";
import type { PasskeySummary } from "./queries";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** A readable default name for the passkey of this device. */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "PC Windows";
  return "Cet appareil";
}

/**
 * Face ID, fingerprint or screen lock instead of the password. Added and removed through the
 * Better Auth client from the browser (WebAuthn needs it): auth exception of apps/web/CLAUDE.md.
 */
export function PasskeysCard({ passkeys }: { passkeys: PasskeySummary[] }) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Browser capability only (no data from the API).
  useEffect(() => setSupported(Boolean(window.PublicKeyCredential)), []);

  const add = () =>
    startTransition(async () => {
      setResult(null);
      const response = await authClient.passkey.addPasskey({ name: deviceName() });
      if (response?.error) {
        setResult({ tone: "error", text: authErrorMessage(response.error) });
        return;
      }
      setResult({
        tone: "success",
        text: "Passkey ajoutée : tu peux te connecter sans mot de passe.",
      });
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setResult(null);
      const response = await authClient.passkey.deletePasskey({ id });
      if (response.error) {
        setResult({ tone: "error", text: authErrorMessage(response.error) });
        return;
      }
      router.refresh();
    });

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Connecte-toi avec Face ID, ton empreinte ou le code de ton téléphone, sans mot de passe.
        </CardDescription>
      </div>
      {result ? <FormAlert tone={result.tone}>{result.text}</FormAlert> : null}
      {passkeys.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 px-3">
              <Fingerprint aria-hidden className="size-5 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{p.name || "Passkey"}</span>
                <span className="text-muted-foreground text-xs">
                  Ajoutée le {dateFormat.format(p.createdAt)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Supprimer la passkey ${p.name || ""}`.trim()}
                onClick={() => remove(p.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {supported ? (
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={add}>
          <Fingerprint aria-hidden />
          {pending ? "Patiente…" : "Ajouter une passkey"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">Ce navigateur ne gère pas les passkeys.</p>
      )}
    </Card>
  );
}
