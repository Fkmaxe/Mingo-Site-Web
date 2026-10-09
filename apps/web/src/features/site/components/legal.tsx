import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ORGANIZATION } from "../content/organization";
import { confirmed, type Fact, isPending } from "../content/pending";
import { SITE } from "../content/site";
import type { LegalPerson } from "../content/types";
import { formatSiren, formatSiret } from "../format";

/** « À préciser » marker: visible and greppable, never serialized in structured data. */
export function PendingValue({
  reason,
  className,
}: {
  readonly reason?: string | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="eyebrow rounded-sm border px-2 py-0.5 text-xs">À préciser</span>
      {reason ? <span className="sr-only">{reason}</span> : null}
    </span>
  );
}

/** A label / value pair of a legal sheet. Values keep the main text color (readable, AA). */
export function LegalField({
  label,
  value,
  children,
  note,
}: {
  readonly label: string;
  readonly value?: Fact<string> | undefined;
  readonly children?: ReactNode | undefined;
  readonly note?: string | undefined;
}) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6">
      <dt className="eyebrow text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium text-base text-foreground">
        {children ??
          (value !== undefined && isPending(value) ? (
            <PendingValue reason={value.reason} />
          ) : (
            value
          ))}
        {note ? <p className="mt-1 font-normal text-muted-foreground text-sm">{note}</p> : null}
      </dd>
    </div>
  );
}

/** The association's identity sheet. Its identifiers are written nowhere else. */
export function LegalIdentity({
  variant = "full",
  className,
}: {
  readonly variant?: "full" | "compact" | undefined;
  readonly className?: string | undefined;
}) {
  const email = confirmed(ORGANIZATION.email);
  const address = ORGANIZATION.address;
  const addressLines = (
    <>
      {address.organizationName}
      <br />
      {address.streetAddress}
      <br />
      {address.postalCode} {address.addressLocality}, {address.addressCountry}
    </>
  );
  const contact = email ? (
    <a className="underline underline-offset-4" href={`mailto:${email}`}>
      {email}
    </a>
  ) : null;

  return (
    <dl className={cn("grid gap-0", className)}>
      <LegalField label="Nom légal" value={ORGANIZATION.legalName} />
      <LegalField
        label={variant === "full" ? "Statut juridique" : "Statut"}
        value={ORGANIZATION.legalStatus}
      />
      <LegalField label="Numéro RNA" value={ORGANIZATION.rna} />
      <LegalField label="SIRET" value={formatSiret(ORGANIZATION.siret)} />
      {variant === "full" ? (
        <LegalField label="SIREN" value={formatSiren(ORGANIZATION.siren)} />
      ) : null}
      <LegalField label="Siège social">{addressLines}</LegalField>
      {variant === "full" ? (
        <LegalField label="Active depuis le" value={ORGANIZATION.activeSince} />
      ) : null}
      {contact ? (
        <LegalField label={variant === "full" ? "Adresse de contact" : "Contact"}>
          {contact}
        </LegalField>
      ) : (
        <LegalField label="Adresse de contact" value={ORGANIZATION.email} />
      )}
      {variant === "full" ? <LegalField label="Site officiel" value={SITE.domain} /> : null}
    </dl>
  );
}

/** Identity of a publisher or of the host, as the LCEN (article 6-III) requires. */
export function LegalPersonSheet({ person }: { readonly person: LegalPerson }) {
  return (
    <dl className="grid gap-0">
      <LegalField label="Nom et prénom" value={person.name} />
      {person.role ? <LegalField label="Qualité" value={person.role} /> : null}
      {person.status ? <LegalField label="Statut" value={person.status} /> : null}
      {person.siret ? <LegalField label="SIRET" value={formatSiret(person.siret)} /> : null}
      {person.siren ? <LegalField label="SIREN" value={formatSiren(person.siren)} /> : null}
      {person.activity ? <LegalField label="Activité (code NAF)" value={person.activity} /> : null}
      {person.address ? (
        <LegalField label="Adresse professionnelle" value={person.address} />
      ) : null}
      {person.terms ? <LegalField label="Conditions" value={person.terms} /> : null}
    </dl>
  );
}

/** Ties the domain to the association and its registrations. */
export function OfficialSiteNotice({
  withIdentifiers = false,
  className,
}: {
  readonly withIdentifiers?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <p className={cn("text-sm leading-relaxed", className)}>
      <strong className="font-semibold">{SITE.domain}</strong> est le site officiel de l'association{" "}
      {ORGANIZATION.legalName}
      {withIdentifiers
        ? ` (RNA ${ORGANIZATION.rna}, SIRET ${formatSiret(ORGANIZATION.siret)})`
        : ""}
      , bureau des étudiants de l'ESGI.
    </p>
  );
}
