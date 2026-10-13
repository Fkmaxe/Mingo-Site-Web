import { cn } from "@/lib/utils";

/** Initials from a full name: "Jeanne de La Tour" -> "JD" (first and last word). */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** Profile photo, or the initials on the brand gradient when there is none. */
export function Avatar({
  name,
  url,
  size = 40,
  className,
}: {
  name: string;
  url: string | null | undefined;
  size?: number;
  className?: string | undefined;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: private photo through the web proxy.
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={cn("shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue font-bold font-display text-white italic",
        className,
      )}
    >
      {nameInitials(name)}
    </span>
  );
}
