import type { Registrant } from "./types";

export function RegistrantsList({ registrants }: { registrants: Registrant[] }) {
  const confirmed = registrants.filter((r) => r.status === "confirmed");
  if (confirmed.length === 0) {
    return <p className="text-muted-foreground text-sm">Personne n'est inscrit pour l'instant.</p>;
  }
  return (
    <ol className="flex flex-col divide-y rounded-xl border">
      {confirmed.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3">
          <span className="font-medium">{r.user.name}</span>
          <span className="break-all text-muted-foreground text-xs">
            {r.user.email}
            {r.user.promo ? ` · ${r.user.promo}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
