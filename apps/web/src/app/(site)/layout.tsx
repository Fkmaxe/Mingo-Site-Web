import type * as React from "react";
import { JsonLd } from "@/features/site/components/json-ld";
import { RevealInit } from "@/features/site/components/reveal";
import { SiteFooter } from "@/features/site/components/site-footer";
import { SiteHeader } from "@/features/site/components/site-header";
import { buildOrganization, buildWebSite } from "@/features/site/json-ld";
import { getVisitor } from "@/features/site/queries";
import { env } from "@/lib/server-env";

const MAIN_CONTENT_ID = "contenu-principal";

/** Showcase site: its own header, footer and theme (`.site` tokens in globals.css). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const me = await getVisitor();
  return (
    <div className="site flex min-h-dvh flex-col">
      <RevealInit />
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>
      <SiteHeader me={me} />
      <main id={MAIN_CONTENT_ID} className="flex-1">
        {children}
      </main>
      <SiteFooter signedIn={me !== null} />
      <JsonLd data={buildOrganization(env.SITE_URL)} />
      <JsonLd data={buildWebSite(env.SITE_URL)} />
    </div>
  );
}
