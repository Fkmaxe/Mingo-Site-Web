"use client";

import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { renewCalendarFeedAction, revokeCalendarFeedAction } from "./actions";

/** webcal:// opens the calendar app (Apple Calendar) on the same address. */
export const webcalUrl = (url: string) => url.replace(/^https?:\/\//, "webcal://");
/** Google Agenda's "add by URL" screen, pre-filled. */
export const googleCalendarUrl = (url: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(url))}`;

/**
 * The member's private iCal link: one tap for Apple Calendar or Google Agenda, copy for the
 * others. Renewing it cuts off the old link (a lost phone, a shared link).
 */
export function CalendarSync({ url }: { url: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok ? { tone: "success", text: success } : { tone: "error", text: result.message },
      );
      router.refresh();
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ tone: "success", text: "Lien copié." });
    } catch {
      setMessage({ tone: "error", text: "Copie impossible : sélectionne le lien à la main." });
    }
  };

  return (
    <section
      aria-labelledby="sync-title"
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm"
    >
      <h2 id="sync-title" className="font-semibold">
        Dans mon agenda
      </h2>
      <p className="text-muted-foreground text-sm">
        Abonne Apple Calendar ou Google Agenda à ton calendrier du BDE : événements, réunions et
        tâches s'y mettent à jour tout seuls (Google peut prendre quelques heures). Ce lien est
        personnel, ne le partage pas.
      </p>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      {url ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg">
              <a href={webcalUrl(url)}>Ajouter à Apple Calendar</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={googleCalendarUrl(url)} target="_blank" rel="noreferrer">
                Ajouter à Google Agenda
              </a>
            </Button>
          </div>
          <label htmlFor="feed-url" className="font-medium text-sm">
            Lien iCal (Outlook, autres agendas)
          </label>
          <div className="flex gap-2">
            <input
              id="feed-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border bg-muted px-3 text-sm"
            />
            <Button variant="outline" size="icon" aria-label="Copier le lien" onClick={copy}>
              <Copy aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(renewCalendarFeedAction, "Nouveau lien créé : l'ancien ne marche plus.")
              }
            >
              <RefreshCw aria-hidden />
              Nouveau lien
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(revokeCalendarFeedAction, "Lien supprimé.")}
            >
              <Trash2 aria-hidden />
              Supprimer le lien
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="lg"
          className="self-start"
          disabled={pending}
          onClick={() => run(renewCalendarFeedAction, "Ton lien est prêt.")}
        >
          Créer mon lien d'abonnement
        </Button>
      )}
    </section>
  );
}
