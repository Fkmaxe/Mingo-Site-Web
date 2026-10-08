import type * as React from "react";

/** A headline number: sentence-case label, value, optional context line. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-2xl leading-tight">{value}</span>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}
