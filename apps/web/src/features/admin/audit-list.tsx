import { formatDateTime } from "@/lib/paris-time";
import type { AuditEntry } from "./types";

const ACTION_LABELS: Record<string, string> = {
  "membership.set": "Rôle donné",
  "membership.removed": "Rôle retiré",
  "membership.created": "Membre ajouté",
  "user.admin_granted": "Nommé administrateur",
  "user.admin_revoked": "Droits d'administrateur retirés",
  "school_year.created": "Année scolaire créée",
  "school_year.made_current": "Année en cours changée",
  "pole.created": "Pôle créé",
  "pole.updated": "Pôle modifié",
  "event.created": "Événement créé",
  "event.updated": "Événement modifié",
  "event.published": "Événement publié",
  "event.cancelled": "Événement annulé",
  "event.deleted": "Brouillon supprimé",
};

/** Short readable summary of the entry's details (names, emails, labels). */
function details(payload: AuditEntry["payload"]): string {
  if (!payload) return "";
  return Object.entries(payload)
    .filter(([key, value]) => typeof value === "string" && !key.endsWith("Id") && value.length < 80)
    .map(([, value]) => String(value))
    .join(" · ");
}

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Aucune action enregistrée.</p>;
  }
  return (
    <ol className="flex flex-col divide-y rounded-2xl border bg-card shadow-primary/5 shadow-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
          <span className="font-semibold">{ACTION_LABELS[e.action] ?? e.action}</span>
          {details(e.payload) ? (
            <span className="break-words text-xs">{details(e.payload)}</span>
          ) : null}
          <span className="text-muted-foreground text-xs">
            {formatDateTime(e.createdAt)} · {e.actor ? e.actor.name : "commande serveur"}
          </span>
        </li>
      ))}
    </ol>
  );
}
