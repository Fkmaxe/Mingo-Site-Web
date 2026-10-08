"use client";

import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustAction, searchAccountsAction } from "./actions";
import { formatPoints } from "./labels";
import type { OpenPointsAccount } from "./types";

export function AdjustForm() {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<OpenPointsAccount[] | null>(null);
  const [target, setTarget] = useState<OpenPointsAccount | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await searchAccountsAction(query);
      setAccounts(result.accounts);
      setMessage(result.error ? { tone: "error", text: result.error } : null);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const n = Number(delta);
    const fieldErrors: Record<string, string> = {};
    if (!Number.isInteger(n) || n === 0) fieldErrors.delta = "Indique un nombre entier non nul";
    if (!reason.trim()) fieldErrors.reason = "Indique le motif de l'ajustement";
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    startTransition(async () => {
      const result = await adjustAction({ userId: target.user.id, delta: n, reason });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({
        tone: "success",
        text: `${formatPoints(n, true)} pour ${target.user.name}, enregistré.`,
      });
      setTarget(null);
      setDelta("");
      setReason("");
      setAccounts(null);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      {target ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
            <p className="font-semibold">{target.user.name}</p>
            <p className="text-muted-foreground text-sm">
              Solde actuel : {formatPoints(target.balance)}
            </p>
          </div>
          <FormField
            id="delta"
            label="Points (négatif pour retirer)"
            type="number"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            error={errors.delta}
          />
          <FormField
            id="reason"
            label="Motif"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={errors.reason}
            hint="Obligatoire, gardé dans l'historique"
          />
          <div className="flex gap-2">
            <Button type="submit" size="lg" className="flex-1" disabled={pending}>
              Enregistrer
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setTarget(null)}>
              Retour
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <form onSubmit={search} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="account-search">Étudiant (nom ou email)</Label>
              <Input
                id="account-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="icon" aria-label="Chercher" disabled={pending}>
              <Search aria-hidden />
            </Button>
          </form>
          {accounts && accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Personne ne correspond.</p>
          ) : null}
          <ul className="flex flex-col divide-y rounded-xl border">
            {(accounts ?? []).map((account) => (
              <li
                key={account.user.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{account.user.name}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {account.isMember ? "Membre du BDE" : formatPoints(account.balance)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={account.isMember}
                  onClick={() => setTarget(account)}
                >
                  Choisir
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
