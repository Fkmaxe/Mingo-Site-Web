import Image from "next/image";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** The BDE Mingo logo (flamingo badge). `size` is its height in pixels. */
export function Logo({
  size = 40,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="BDE Mingo"
      width={Math.round(size * (744 / 700))}
      height={size}
      priority={priority ?? false}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** Heavy italic title, as on the BDE's posters. */
export function DisplayTitle({
  as: Tag = "h1",
  className,
  ...props
}: React.ComponentProps<"h1"> & { as?: "h1" | "h2" | "p" }) {
  return (
    <Tag
      className={cn(
        "font-display font-extrabold text-3xl uppercase italic leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

/** Page title with an optional line below and an action on the right. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <DisplayTitle className="text-[1.75rem]">{title}</DisplayTitle>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Pink -> lavender -> blue panel of the posters; text on it is white. */
export function BrandPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue p-5 text-white shadow-lg shadow-primary/15",
        className,
      )}
      {...props}
    />
  );
}

/** Pill like the posters' date and place labels. */
export function Pill({
  tone = "blue",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: "blue" | "pink" | "glass" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display font-semibold text-sm italic",
        tone === "blue" && "bg-primary text-primary-foreground",
        tone === "pink" && "bg-brand-pink text-brand-pink-foreground",
        tone === "glass" && "bg-white/20 text-white backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
