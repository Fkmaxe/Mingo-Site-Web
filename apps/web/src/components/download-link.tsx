import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plain link (not client navigation): the browser downloads the file. */
export function DownloadLink({ href, children }: { href: string; children: string }) {
  return (
    <Button asChild variant="outline">
      <a href={href} download>
        <Download aria-hidden />
        {children}
      </a>
    </Button>
  );
}
