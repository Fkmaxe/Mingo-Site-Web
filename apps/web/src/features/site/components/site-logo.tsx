import Image from "next/image";
import { cn } from "@/lib/utils";
import { SITE } from "../content/site";

type LogoVariant = "header" | "hero" | "footer";

/**
 * `self-start` matters: in a flex column a child is stretched on the cross axis, which squashes
 * the logo and ignores its ratio.
 */
const VARIANTS: Record<LogoVariant, { className: string; sizes: string; priority: boolean }> = {
  header: { className: "h-11 w-auto self-start", sizes: "48px", priority: true },
  hero: {
    className: "h-auto w-full max-w-md",
    sizes: "(min-width: 1024px) 28rem, 80vw",
    priority: true,
  },
  footer: { className: "h-16 w-auto self-start", sizes: "72px", priority: false },
};

/** The only way the showcase shows its logo. The alt text describes the picture. */
export function SiteLogo({
  variant = "header",
  className,
}: {
  readonly variant?: LogoVariant | undefined;
  readonly className?: string | undefined;
}) {
  const config = VARIANTS[variant];
  return (
    <Image
      src={SITE.logo}
      width={SITE.logoWidth}
      height={SITE.logoHeight}
      alt={SITE.logoAlt}
      sizes={config.sizes}
      priority={config.priority}
      className={cn(config.className, className)}
    />
  );
}
