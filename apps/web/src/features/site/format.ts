import type { PostalAddress } from "./content/types";

/** 91888056800012 → « 918 880 568 00012 ». The only way a SIRET is displayed. */
export function formatSiret(siret: string): string {
  const digits = siret.replace(/\D/g, "");
  if (digits.length !== 14) return siret;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}

/** 918880568 → « 918 880 568 ». */
export function formatSiren(siren: string): string {
  const digits = siren.replace(/\D/g, "");
  if (digits.length !== 9) return siren;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

const DAY_WITH_YEAR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** « samedi 14 septembre 2026 » (Paris time): past events need their year. */
export function formatDayWithYear(iso: string): string {
  return DAY_WITH_YEAR.format(new Date(iso));
}

/** One-line address, for the footer and external links. */
export function formatAddressInline(address: PostalAddress): string {
  return `${address.organizationName}, ${address.streetAddress}, ${address.postalCode} ${address.addressLocality}, ${address.addressCountry}`;
}

/** Map search link. No embedded map, no third-party cookie. */
export function mapSearchUrl(address: PostalAddress): string {
  const query = encodeURIComponent(
    `${address.streetAddress}, ${address.postalCode} ${address.addressLocality}`,
  );
  return `https://www.openstreetmap.org/search?query=${query}`;
}

/** First sentences of a description, cut on a word boundary. */
export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}
