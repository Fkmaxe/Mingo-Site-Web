"use client";

import { type CustomFieldDef, formatAnswer, RHYTHM_LABELS } from "@bde/shared";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
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

const NONE = "__none__";
const distinct = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => v !== null))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

type Filter = { level: string; track: string; rhythm: string };

function matches(r: Registrant, f: Filter) {
  const ok = (value: string | null, wanted: string) =>
    wanted === "" || (wanted === NONE ? value === null : value === wanted);
  return ok(r.user.level, f.level) && ok(r.user.track, f.track) && ok(r.user.rhythm, f.rhythm);
}

/** Filters by year, programme and rhythm; only shown when registrants have a class. */
function ClassFilters({
  registrants,
  filter,
  onChange,
}: {
  registrants: Registrant[];
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  const levels = distinct(registrants.map((r) => r.user.level));
  const tracks = distinct(registrants.map((r) => r.user.track));
  const rhythms = distinct(registrants.map((r) => r.user.rhythm));
  if (levels.length + tracks.length + rhythms.length === 0) return null;
  const select = (
    key: keyof Filter,
    label: string,
    values: string[],
    name: (v: string) => string,
  ) => (
    <NativeSelect
      aria-label={label}
      value={filter[key]}
      onChange={(e) => onChange({ ...filter, [key]: e.target.value })}
      className="h-10 text-sm"
    >
      <option value="">{label}</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {name(v)}
        </option>
      ))}
      <option value={NONE}>Non renseigné</option>
    </NativeSelect>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {select("level", "Année", levels, (v) => v)}
      {select("track", "Filière", tracks, (v) => v)}
      {select(
        "rhythm",
        "Rythme",
        rhythms,
        (v) => RHYTHM_LABELS[v as keyof typeof RHYTHM_LABELS] ?? v,
      )}
    </div>
  );
}

export function RegistrantsList({
  registrants,
  fields,
}: {
  registrants: Registrant[];
  fields: CustomFieldDef[];
}) {
  const [filter, setFilter] = useState<Filter>({ level: "", track: "", rhythm: "" });
  const filtered = registrants.filter((r) => matches(r, filter));
  const active = filter.level !== "" || filter.track !== "" || filter.rhythm !== "";
  const confirmed = filtered.filter((r) => r.status === "confirmed");
  // Registrants come in registration order, which is also the waitlist order.
  const waitlisted = filtered.filter((r) => r.status === "waitlisted");
  return (
    <div className="flex flex-col gap-4">
      {registrants.length > 0 ? (
        <ClassFilters registrants={registrants} filter={filter} onChange={setFilter} />
      ) : null}
      {active ? (
        <p className="text-muted-foreground text-sm" role="status">
          {confirmed.length} inscrit{confirmed.length > 1 ? "s" : ""} dans cette sélection
        </p>
      ) : null}
      {confirmed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {active ? "Personne dans cette sélection." : "Personne n'est inscrit pour l'instant."}
        </p>
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
