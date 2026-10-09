"use client";

import { useState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { createSchoolYearAction, setCurrentSchoolYearAction } from "./actions";
import type { SchoolYear } from "./types";
import { useAction } from "./use-action";

const frDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

/** Next school year after the latest one (or the one starting this September). */
function suggestion(years: SchoolYear[]) {
  const latest = years[0];
  const start = latest ? Number(latest.label.slice(0, 4)) + 1 : new Date().getFullYear();
  return {
    label: `${start}-${start + 1}`,
    startsOn: `${start}-09-01`,
    endsOn: `${start + 1}-08-31`,
  };
}

export function YearsAdmin({ years }: { years: SchoolYear[] }) {
  const { run, pending, error } = useAction();
  const [form, setForm] = useState(() => suggestion(years));
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {years.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-primary/5 shadow-sm">
          {years.map((y) => (
            <li key={y.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-col">
                <span className="font-semibold">{y.label}</span>
                <span className="text-muted-foreground text-xs">
                  {frDate(y.startsOn)} → {frDate(y.endsOn)}
                </span>
              </div>
              {y.isCurrent ? (
                <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-semibold text-success text-xs">
                  En cours
                </span>
              ) : confirm === y.id ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setCurrentSchoolYearAction(y.id),
                        () => setConfirm(null),
                      )
                    }
                  >
                    Confirmer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Non
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirm(y.id)}>
                  Passer à cette année
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aucune année scolaire : crée la première, elle deviendra l'année en cours.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Changer d'année en cours change les rôles actifs : les membres de l'année précédente
        redeviennent étudiants : reconduis-les pour la nouvelle année (onglet Membres).
      </p>
      <form
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createSchoolYearAction(form));
        }}
      >
        <h2 className="font-bold font-display">Nouvelle année scolaire</h2>
        <FormField
          id="year-label"
          label="Nom"
          value={form.label}
          placeholder="2026-2027"
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="year-start"
            label="Début"
            type="date"
            value={form.startsOn}
            onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
          />
          <FormField
            id="year-end"
            label="Fin"
            type="date"
            value={form.endsOn}
            onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={pending}>
          Créer l'année
        </Button>
      </form>
    </div>
  );
}
