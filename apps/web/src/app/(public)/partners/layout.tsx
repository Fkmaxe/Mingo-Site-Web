import type * as React from "react";
import { AdaptiveShell } from "@/components/adaptive-shell";

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
