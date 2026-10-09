import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PalmBackdrop } from "./palm-backdrop";
import { Reveal } from "./reveal";

export type SectionTone = "default" | "pastel" | "brand";

const TONES: Record<SectionTone, string> = {
  default: "bg-background text-foreground",
  pastel: "bg-pastel text-pastel-foreground",
  brand: "gradient-tropical",
};

/**
 * Shared shell of every showcase section: vertical rhythm, background, header and reveal.
 * No section sets its own background: changing a page's rhythm means changing `tone`.
 */
export function SectionShell({
  children,
  tone = "default",
  id,
  eyebrow,
  title,
  lead,
  palms = false,
  className,
  reveal = true,
}: {
  readonly children: ReactNode;
  readonly tone?: SectionTone | undefined;
  readonly id?: string | undefined;
  readonly eyebrow?: string | undefined;
  readonly title?: string | undefined;
  readonly lead?: string | undefined;
  readonly palms?: boolean | undefined;
  readonly className?: string | undefined;
  /** Legal blocks do not slide in: they are there from the first paint. */
  readonly reveal?: boolean | undefined;
}) {
  // On navy, the theme's muted gray lacks contrast.
  const eyebrowTone = tone === "brand" ? "text-on-navy-muted" : "text-muted-foreground";
  const header =
    eyebrow || title || lead ? (
      <div className="mb-10 flex flex-col gap-3">
        {eyebrow ? <p className={cn("eyebrow text-sm", eyebrowTone)}>{eyebrow}</p> : null}
        {title ? (
          <h2 className="heading-display text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">
            {title}
          </h2>
        ) : null}
        {lead ? <p className="max-w-2xl text-base leading-relaxed">{lead}</p> : null}
      </div>
    ) : null;

  return (
    <section id={id} className={cn("relative overflow-hidden", TONES[tone], className)}>
      {palms ? <PalmBackdrop className={tone === "brand" ? "text-on-navy" : undefined} /> : null}
      <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20 lg:py-24">
        {reveal ? (
          <Reveal>
            {header}
            {children}
          </Reveal>
        ) : (
          <>
            {header}
            {children}
          </>
        )}
      </div>
    </section>
  );
}
