import { cn } from "@/lib/utils";

/** Palm pattern behind a section: decorative, follows the text color (CSS mask). */
export function PalmBackdrop({ className }: { readonly className?: string | undefined }) {
  return <div aria-hidden className={cn("palm-backdrop text-foreground", className)} />;
}
