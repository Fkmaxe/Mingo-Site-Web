"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copies the address. The address stays displayed as plain text next to it: this button is a
 * convenience, never the only way to read it.
 */
export function CopyEmailButton({
  email,
  className,
}: {
  readonly email: string;
  readonly className?: string | undefined;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={copy} className={cn(className)}>
        {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
        {state === "copied" ? "Adresse copiée" : "Copier l'adresse"}
      </Button>
      <p role="status" className="text-sm">
        {state === "failed" ? "La copie a échoué : sélectionne l'adresse pour la copier." : ""}
      </p>
    </div>
  );
}
