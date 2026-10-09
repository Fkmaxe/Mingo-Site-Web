import Link from "next/link";
import { siteHref } from "../routes";
import { PalmBackdrop } from "./palm-backdrop";

/** Header of the inner pages: breadcrumb, title and lead, on a pastel background. */
export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly lead: string;
}) {
  return (
    <div className="relative overflow-hidden border-b bg-pastel text-pastel-foreground">
      <PalmBackdrop className="opacity-[0.06]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
        <nav aria-label="Fil d'Ariane" className="mb-5">
          <ol className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            <li>
              <Link href={siteHref("home")} className="underline-offset-4 hover:underline">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {title}
            </li>
          </ol>
        </nav>
        <p className="eyebrow mb-3 text-muted-foreground text-sm">{eyebrow}</p>
        <h1 className="heading-display text-4xl leading-[0.98] sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-foreground text-lg">{lead}</p>
      </div>
    </div>
  );
}
