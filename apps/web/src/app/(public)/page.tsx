import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/session";

export default async function LandingPage() {
  if (await getMe()) redirect("/home");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end gap-8 px-4 pt-16 pb-10 md:justify-center">
      <div className="flex flex-col gap-3">
        <p className="font-bold text-4xl text-primary">BDE Mingo</p>
        <h1 className="font-semibold text-2xl leading-tight">
          Les événements du BDE de l'ESGI Paris, ton billet et tes points open.
        </h1>
        <p className="text-muted-foreground">Connecte-toi avec ton adresse @myskolae.fr.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/login">Se connecter</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/signup">Créer un compte</Link>
        </Button>
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/events" className="text-primary underline-offset-4 hover:underline">
            Les événements
          </Link>
          <Link href="/partners" className="text-primary underline-offset-4 hover:underline">
            Nos partenaires
          </Link>
        </div>
      </div>
    </main>
  );
}
