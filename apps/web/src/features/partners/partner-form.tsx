"use client";

import { CreatePartnerInput, PARTNER_STATUSES } from "@bde/shared";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { createPartnerAction, deletePartnerAction, updatePartnerAction } from "./actions";
import { PARTNER_STATUS_LABELS } from "./labels";
import type { Partner } from "./types";

type Props = {
  partner?: Partner;
  /** Board only: who can be referent; absent for a referent editing their partner. */
  owners?: { membershipId: string; name: string }[] | undefined;
  canDelete?: boolean;
};

export function PartnerForm({ partner, owners, canDelete = false }: Props) {
  const [values, setValues] = useState({
    name: partner?.name ?? "",
    website: partner?.website ?? "",
    contactName: partner?.contactName ?? "",
    contactEmail: partner?.contactEmail ?? "",
    status: partner?.status ?? "prospect",
    benefits: partner?.benefits ?? "",
    notes: partner?.notes ?? "",
    ownerMembershipId: partner?.owner?.membershipId ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const set =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreatePartnerInput.safeParse({
      ...values,
      website: values.website.trim() || null,
      contactEmail: values.contactEmail.trim() || null,
      // Referents do not see nor send the referent field.
      ownerMembershipId: owners ? values.ownerMembershipId || null : null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const { ownerMembershipId, ...fields } = parsed.data;
      const outcome = partner
        ? await updatePartnerAction(partner.id, owners ? parsed.data : fields)
        : await createPartnerAction({ ...fields, ownerMembershipId });
      setResult(outcome);
      if (!outcome.ok) setErrors(outcome.fieldErrors);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {result && !result.ok ? <FormAlert tone="error">{result.message}</FormAlert> : null}
      {result?.ok ? <FormAlert tone="success">Fiche enregistrée.</FormAlert> : null}
      <FormField
        id="partner-name"
        label="Nom"
        value={values.name}
        onChange={set("name")}
        error={errors.name}
      />
      <FieldShell id="partner-status" label="Statut" error={errors.status}>
        {(aria) => (
          <NativeSelect {...aria} value={values.status} onChange={set("status")}>
            {PARTNER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PARTNER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>
      <FormField
        id="partner-website"
        label="Site web"
        type="url"
        placeholder="https://"
        value={values.website}
        onChange={set("website")}
        error={errors.website}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="partner-contact"
          label="Contact"
          value={values.contactName}
          onChange={set("contactName")}
        />
        <FormField
          id="partner-email"
          label="Email du contact"
          type="email"
          value={values.contactEmail}
          onChange={set("contactEmail")}
          error={errors.contactEmail}
        />
      </div>
      <FieldShell
        id="partner-benefits"
        label="Avantages pour les étudiants"
        hint="Affiché sur la page publique quand le partenaire est actif"
        error={errors.benefits}
      >
        {(aria) => (
          <Textarea {...aria} rows={3} value={values.benefits} onChange={set("benefits")} />
        )}
      </FieldShell>
      <FieldShell
        id="partner-notes"
        label="Notes internes (contreparties, suivi…)"
        error={errors.notes}
      >
        {(aria) => <Textarea {...aria} rows={4} value={values.notes} onChange={set("notes")} />}
      </FieldShell>
      {owners ? (
        <FieldShell id="partner-owner" label="Référent" error={errors.ownerMembershipId}>
          {(aria) => (
            <NativeSelect
              {...aria}
              value={values.ownerMembershipId}
              onChange={set("ownerMembershipId")}
            >
              <option value="">Personne</option>
              {owners.map((o) => (
                <option key={o.membershipId} value={o.membershipId}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {partner ? "Enregistrer" : "Créer le partenaire"}
      </Button>
      {partner && canDelete ? (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => setResult(await deletePartnerAction(partner.id)))
          }
        >
          Supprimer le partenaire
        </Button>
      ) : null}
    </form>
  );
}
