"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { slug: string; title: string; className?: string };

/** Shares the event's page (system share sheet on a phone), or copies its link. */
export function ShareButton({ slug, title, className }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/events/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closed by the user: nothing to do. Other failures fall back to the clipboard.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (insecure context): the address bar still has the link.
    }
  };

  return (
    <Button type="button" variant="outline" size="lg" className={className} onClick={share}>
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
      <span aria-live="polite">{copied ? "Lien copié" : "Partager l'événement"}</span>
    </Button>
  );
}
