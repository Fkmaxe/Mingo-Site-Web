import Link from "next/link";
import { DisplayTitle, Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo size={120} className="-rotate-6" />
      <DisplayTitle>Page introuvable</DisplayTitle>
      <p className="text-muted-foreground">
        Ce lien ne mène nulle part, ou tu n'as pas accès à cette page.
      </p>
      <Button asChild size="lg">
        <Link href="/">Retour à l'accueil</Link>
      </Button>
    </main>
  );
}
