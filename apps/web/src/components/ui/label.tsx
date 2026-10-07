import type * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed by the caller
  return <label className={cn("font-medium text-sm leading-none", className)} {...props} />;
}

export { Label };
