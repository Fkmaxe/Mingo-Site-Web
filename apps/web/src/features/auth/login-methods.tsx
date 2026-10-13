"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CodeSignIn } from "./code-sign-in";
import { PasskeySignIn } from "./passkey-sign-in";
import { SignInForm } from "./sign-in-form";

const METHODS = [
  ["password", "Mot de passe"],
  ["code", "Code par mail"],
] as const;

/** Password or one-time code by mail, plus passkey (Face ID / fingerprint) when available. */
export function LoginMethods({ next }: { next?: string | undefined }) {
  const [method, setMethod] = useState<"password" | "code">("password");
  return (
    <div className="flex flex-col gap-4">
      <PasskeySignIn next={next} />
      <div
        role="tablist"
        aria-label="Méthode de connexion"
        className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm"
      >
        {METHODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "min-h-10 rounded-full font-semibold",
              method === value ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {method === "password" ? <SignInForm next={next} /> : <CodeSignIn next={next} />}
    </div>
  );
}
