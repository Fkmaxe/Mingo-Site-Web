import type { LegalPerson, Organization } from "./types";

/**
 * SINGLE SOURCE OF TRUTH for the association's legal identity: footer, « Qui sommes-nous »,
 * legal notice and structured data all read this file. The SIRET is stored without spaces and
 * displayed through `formatSiret`.
 */
export const ORGANIZATION: Organization = {
  legalName: "BDE MINGO",
  displayName: "BDE Mingo",
  legalStatus: "Association loi 1901, à but non lucratif",
  rna: "W751266715",
  siret: "91888056800012",
  siren: "918880568",
  address: {
    organizationName: "ESGI",
    streetAddress: "242 rue du Faubourg Saint-Antoine",
    postalCode: "75012",
    addressLocality: "Paris",
    addressCountry: "France",
  },
  mission: "Organisation d'événements et animation de la vie étudiante de l'ESGI.",
  missionSource: "Objet statutaire défini à l'article 2 des statuts de l'association.",
  activeSince: "31 août 2022",
  activeSinceISO: "2022-08-31",
  email: "bureau@bde-mingo.fr",
  publicationDirector: "Sulyvan Sayah, président du BDE Mingo",
  timeline: [
    {
      id: "creation",
      date: "31 août 2022",
      dateISO: "2022-08-31",
      title: "L'association est active",
      description:
        "L'association est déclarée et commence à animer la vie étudiante de l'ESGI, à Paris.",
    },
    {
      id: "bureau-2026",
      date: "2026",
      dateISO: null,
      title: "Un nouveau bureau",
      description:
        "Un nouveau bureau est élu pour porter le BDE Mingo : événements, partenariats et espace étudiant en ligne.",
    },
  ],
};

export const CREDITS = {
  siteAuthor: "Le BDE Mingo",
  logoAuthor: "Amélie Narbone",
} as const;

/** Maxence Grados both publishes and hosts the site. */
const MAXENCE_GRADOS: LegalPerson = {
  id: "maxence-grados",
  name: "Maxence Grados",
  status: "Auto-entrepreneur",
  siret: "99236282200015",
  siren: "992362822",
  activity: "6311Z — Traitement de données, hébergement et activités connexes",
  address: "11 B rue des Prés d'Aulnay, 91220 Brétigny-sur-Orge",
  terms: "À titre gratuit",
};

/** Publishers of the site (LCEN, article 6-III). */
export const PUBLISHERS: readonly LegalPerson[] = [
  MAXENCE_GRADOS,
  { id: "jeremy-cheny", name: "Jérémy Chény", role: "Secrétaire du BDE Mingo" },
];

/** Host of the site (LCEN, article 6-III). */
export const HOST: LegalPerson = MAXENCE_GRADOS;
