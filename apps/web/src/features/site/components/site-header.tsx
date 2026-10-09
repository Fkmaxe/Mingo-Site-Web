import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/initials";
import type { Me } from "@/lib/session";
import { LEGAL_NAV, MAIN_NAV } from "../content/navigation";
import { SITE } from "../content/site";
import { siteHref } from "../routes";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { SiteLogo } from "./site-logo";

const MOBILE_ITEMS = [...MAIN_NAV, LEGAL_NAV];

/**
 * Showcase header. The account entry is always visible, on phones too: « Se connecter » for
 * visitors, the user's space once signed in.
 */
export function SiteHeader({ me }: { readonly me: Me | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-8">
        <Link
          href={siteHref("home")}
          className="flex shrink-0 items-center rounded-md"
          aria-label={`${SITE.name}, retour à l'accueil`}
        >
          <SiteLogo variant="header" />
        </Link>

        <div className="ml-auto hidden lg:flex lg:items-center lg:gap-2">
          <MainNav items={MAIN_NAV} />
          <Button asChild variant="ghost" size="sm">
            <Link href={siteHref("legal")}>{LEGAL_NAV.label}</Link>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          {me ? (
            <Button asChild size="sm" className="gap-2 pl-1.5">
              <Link href="/home">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 font-bold text-xs"
                >
                  {initials(me.firstName, me.lastName)}
                </span>
                Mon espace
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm">
                <Link href="/login">
                  <LogIn aria-hidden />
                  Se connecter
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">
                  <UserRound aria-hidden />
                  Créer un compte
                </Link>
              </Button>
            </>
          )}
          <MobileNav items={MOBILE_ITEMS} signedIn={me !== null} />
        </div>
      </div>
    </header>
  );
}
