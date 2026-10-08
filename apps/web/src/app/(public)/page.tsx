import { CalendarDays, Handshake, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DisplayTitle, Logo, Pill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/session";

const PERKS = [
  { icon: CalendarDays, label: "Inscris-toi aux soirées et tournois en 2 clics" },
  { icon: Ticket, label: "Ton billet QR toujours dans la poche, même hors ligne" },
  { icon: Sparkles, label: "Gagne des points open à chaque événement" },
] as const;

export default async function LandingPage() {
  if (await getMe()) redirect("/home");
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue text-white">
      {/* Soft light blobs, like the posters' liquid background. */}
      <div
        aria-hidden
        className="absolute -top-24 -left-24 -z-10 size-80 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute right-[-6rem] bottom-24 -z-10 size-96 rounded-full bg-brand-cyan/30 blur-3xl"
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-8 text-center md:justify-center">
        <Logo size={150} priority className="drop-shadow-xl" />
        <Pill tone="blue" className="px-4 py-1.5 text-xs uppercase not-italic tracking-[0.2em]">
          Le BDE de l'ESGI Paris
        </Pill>
        <DisplayTitle className="text-balance text-[2.6rem] drop-shadow-sm sm:text-5xl">
          Tes soirées, tes billets, tes points
        </DisplayTitle>
        <ul className="flex w-full flex-col gap-2 text-left">
          {PERKS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 text-sm backdrop-blur"
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex w-full flex-col gap-3 md:mt-2">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary shadow-black/10 shadow-lg hover:bg-white/90"
          >
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button asChild size="lg" variant="brand">
            <Link href="/signup">Créer mon compte</Link>
          </Button>
          <p className="text-sm text-white/85">Avec ton adresse @myskolae.fr.</p>
          <div className="flex justify-center gap-5 text-sm">
            <Link
              href="/events"
              className="flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
            >
              <CalendarDays aria-hidden className="size-4" />
              Les événements
            </Link>
            <Link
              href="/partners"
              className="flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
            >
              <Handshake aria-hidden className="size-4" />
              Nos partenaires
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
