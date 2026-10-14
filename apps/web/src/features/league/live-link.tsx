import { Tv } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Opens the tournament's live screen (to show on a TV), in a new tab. */
export function LiveLink({ slug }: { slug: string }) {
  return (
    <Button asChild variant="outline" size="lg">
      <Link href={`/live/${slug}`} target="_blank" rel="noopener">
        <Tv aria-hidden />
        Affichage TV en direct
      </Link>
    </Button>
  );
}
