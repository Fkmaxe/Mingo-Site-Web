import { type CustomFieldDef, formatAnswer } from "@bde/shared";
import type { Registrant } from "./types";

function People({ people, fields }: { people: Registrant[]; fields: CustomFieldDef[] }) {
  return (
    <ol className="flex flex-col divide-y rounded-xl border">
      {people.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3">
          <span className="font-medium">
            {r.user.name}
            {r.team ? <span className="font-normal text-muted-foreground"> · {r.team}</span> : null}
          </span>
          <span className="break-all text-muted-foreground text-xs">
            {r.user.email}
            {r.user.promo ? ` · ${r.user.promo}` : ""}
          </span>
          {fields.length > 0 ? (
            <span className="text-xs">
              {fields
                .map((f) => `${f.label} : ${formatAnswer(r.answers[f.key]) || "—"}`)
                .join(" · ")}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function RegistrantsList({
  registrants,
  fields,
}: {
  registrants: Registrant[];
  fields: CustomFieldDef[];
}) {
  const confirmed = registrants.filter((r) => r.status === "confirmed");
  // Registrants come in registration order, which is also the waitlist order.
  const waitlisted = registrants.filter((r) => r.status === "waitlisted");
  return (
    <div className="flex flex-col gap-4">
      {confirmed.length === 0 ? (
        <p className="text-muted-foreground text-sm">Personne n'est inscrit pour l'instant.</p>
      ) : (
        <People people={confirmed} fields={fields} />
      )}
      {waitlisted.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">Liste d'attente ({waitlisted.length})</h3>
          <People people={waitlisted} fields={fields} />
        </div>
      ) : null}
    </div>
  );
}
