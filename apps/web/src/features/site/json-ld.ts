import { ORGANIZATION } from "./content/organization";
import { confirmed } from "./content/pending";
import { SITE } from "./content/site";
import { confirmedSocialLinks } from "./content/social";
import type { ShowcaseEvent } from "./events";
import { excerpt, formatAddressInline } from "./format";

/**
 * Structured data builders. They only take confirmed values: a pending value is dropped,
 * never serialized. No financial field, no vatID (a SIRET is not a VAT number).
 */
type JsonLdNode = Record<string, unknown>;

const organizationId = (siteUrl: string) => `${siteUrl}/#organization`;

export function buildOrganization(siteUrl: string): JsonLdNode {
  const email = confirmed(ORGANIZATION.email);
  const socials = confirmedSocialLinks()
    .map((link) => confirmed(link.url))
    .filter((url): url is string => typeof url === "string");

  return {
    "@context": "https://schema.org",
    "@type": "NGO",
    "@id": organizationId(siteUrl),
    name: ORGANIZATION.displayName,
    legalName: ORGANIZATION.legalName,
    description: ORGANIZATION.mission,
    url: siteUrl,
    logo: new URL(SITE.logo, siteUrl).toString(),
    ...(email ? { email } : {}),
    ...(socials.length > 0 ? { sameAs: socials } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: ORGANIZATION.address.streetAddress,
      postalCode: ORGANIZATION.address.postalCode,
      addressLocality: ORGANIZATION.address.addressLocality,
      addressCountry: "FR",
    },
    identifier: [
      { "@type": "PropertyValue", name: "RNA", value: ORGANIZATION.rna },
      { "@type": "PropertyValue", name: "SIRET", value: ORGANIZATION.siret },
      { "@type": "PropertyValue", name: "SIREN", value: ORGANIZATION.siren },
    ],
  };
}

export function buildWebSite(siteUrl: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE.name,
    url: siteUrl,
    inLanguage: "fr-FR",
    publisher: { "@id": organizationId(siteUrl) },
  };
}

export type BreadcrumbStep = { readonly name: string; readonly path: string };

export function buildBreadcrumb(siteUrl: string, steps: readonly BreadcrumbStep[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: new URL(step.path, siteUrl).toString(),
    })),
  };
}

/** Only for events still to come: declaring a past event "scheduled" would be false. */
export function buildEvent(siteUrl: string, event: ShowcaseEvent, path: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    ...(event.description ? { description: excerpt(event.description, 300) } : {}),
    startDate: event.startsAt,
    endDate: event.endsAt,
    url: new URL(path, siteUrl).toString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    // The venue's postal address is not known as structured data: name only.
    location: { "@type": "Place", name: event.location },
    ...(event.posterUrl ? { image: [event.posterUrl] } : {}),
    organizer: { "@id": organizationId(siteUrl) },
  };
}

export function buildAboutPage(siteUrl: string, path: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `Qui sommes-nous — ${ORGANIZATION.displayName}`,
    url: new URL(path, siteUrl).toString(),
    about: { "@id": organizationId(siteUrl) },
    description: `${ORGANIZATION.legalName}, ${ORGANIZATION.legalStatus.toLowerCase()}, ${formatAddressInline(ORGANIZATION.address)}.`,
  };
}

export function buildContactPage(siteUrl: string, path: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact — ${ORGANIZATION.displayName}`,
    url: new URL(path, siteUrl).toString(),
    about: { "@id": organizationId(siteUrl) },
  };
}
