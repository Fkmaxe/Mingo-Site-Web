import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandPanel, DisplayTitle } from "@/components/brand";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/features/auth/safe-next";
import { hasClass } from "@/features/profile/class-status";
import { listClasses } from "@/features/profile/queries";
import { WelcomeClass } from "@/features/profile/welcome-class";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Bienvenue" };

/**
 * First stop after the address is confirmed: the student picks their class (year, programme,
 * number) before entering. Already done, or no class created yet: straight to `next`.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [me, classes] = await Promise.all([requireMe(), listClasses()]);
  const next = safeNextPath((await searchParams).next);
  if (hasClass(me) || (classes.levels.length === 0 && classes.tracks.length === 0)) {
    redirect(next);
  }
  return (
    <div className="flex flex-col gap-5">
      <BrandPanel className="flex flex-col gap-1">
        <p className="font-semibold text-sm text-white/85">Ton compte est prêt 🎉</p>
        <DisplayTitle className="text-[1.65rem]">Bienvenue {me.firstName} !</DisplayTitle>
      </BrandPanel>
      <Card>
        <CardTitle>Ta classe</CardTitle>
        <CardDescription>
          Une dernière étape : ta classe sert aux listes d'inscrits et au classement de la ligue par
          classe. Tu pourras la changer à tout moment dans ton profil.
        </CardDescription>
        <WelcomeClass
          next={next}
          levels={classes.levels}
          tracks={classes.tracks}
          levelId={me.level?.id ?? null}
          trackId={me.track?.id ?? null}
          rhythm={me.rhythm}
          classNumber={me.classNumber}
          januaryIntake={me.januaryIntake}
        />
      </Card>
      <Link
        href={next}
        className="flex min-h-11 items-center justify-center text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        Plus tard
      </Link>
    </div>
  );
}
