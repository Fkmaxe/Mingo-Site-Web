"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ClassForm } from "./class-form";

/** The session in which the prompt was put off: it comes back at the next sign-in. */
const DISMISSED_KEY = "class-prompt-dismissed-session";

function dismissedIn(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/**
 * Asks a student without a class to pick it, once per sign-in: « Plus tard » hides it until the
 * next one. Never on the pages where the class is already asked (onboarding, profile).
 */
export function ClassPrompt(
  props: Omit<ComponentProps<typeof ClassForm>, "onSaved" | "submitLabel">,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const sessionId = data?.session.id;
  const dialog = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState(false);

  const asked = pathname === "/welcome" || pathname === "/profile";
  const show = Boolean(sessionId) && !closed && !asked && dismissedIn() !== sessionId;

  // A modal dialog (focus kept inside, Esc closes it) can only be opened from the DOM.
  useEffect(() => {
    if (show && !dialog.current?.open) dialog.current?.showModal();
  }, [show]);

  const later = () => {
    try {
      if (sessionId) localStorage.setItem(DISMISSED_KEY, sessionId);
    } catch {
      // Storage blocked (private mode): it only comes back on the next page load.
    }
    setClosed(true);
    dialog.current?.close();
  };

  if (!show) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="class-prompt-title"
      onCancel={later}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="class-prompt-title" className="font-bold font-display text-xl">
              C'est quoi ta classe ?
            </h2>
            <p className="text-muted-foreground text-sm">
              Elle sert aux listes d'inscrits et au classement de la ligue par classe. 20 secondes,
              promis.
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Plus tard" onClick={later}>
            <X aria-hidden />
          </Button>
        </div>
        <ClassForm
          {...props}
          submitLabel="Enregistrer ma classe"
          onSaved={() => {
            setClosed(true);
            dialog.current?.close();
            router.refresh();
          }}
        />
        <Button variant="ghost" onClick={later} className="self-center">
          Plus tard
        </Button>
      </div>
    </dialog>
  );
}
