import type * as React from "react";
import { AdaptiveShell } from "@/components/adaptive-shell";

/** Events are readable by visitors; signed-in users keep their navigation. */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
