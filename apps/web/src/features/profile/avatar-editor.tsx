"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { resizePhoto } from "@/lib/resize-photo";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

/** Tap the photo to change it: square crop, resized in the browser, saved at once. */
export function AvatarEditor({ name, url }: { name: string; url: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File) =>
    startTransition(async () => {
      setError(null);
      try {
        const photo = await resizePhoto(file, { maxSide: 512, square: true });
        const form = new FormData();
        form.set("photo", photo, "avatar.jpg");
        const result = await uploadAvatarAction(form);
        if (!result.ok) return setError(result.message);
        router.refresh();
      } catch {
        setError("Cette image ne peut pas être lue.");
      }
    });

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Changer ma photo de profil"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) pick(file);
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className="relative rounded-full ring-2 ring-white/60 focus-visible:outline-none focus-visible:ring-4"
        aria-label={url ? "Changer ma photo de profil" : "Ajouter une photo de profil"}
      >
        <Avatar name={name} url={url} size={72} className={pending ? "opacity-50" : undefined} />
        <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-white text-primary shadow">
          <Camera aria-hidden className="size-4" />
        </span>
      </button>
      {url ? (
        <button
          type="button"
          disabled={pending}
          className="text-white/85 text-xs underline-offset-4 hover:underline"
          onClick={() =>
            startTransition(async () => {
              await removeAvatarAction();
              router.refresh();
            })
          }
        >
          Retirer
        </button>
      ) : null}
      {error ? <p className="max-w-32 text-center text-white text-xs">{error}</p> : null}
    </div>
  );
}
