export const SITE = {
  domain: "bde-mingo.fr",
  name: "BDE Mingo",
  title: "BDE Mingo — bureau des étudiants de l'ESGI",
  description:
    "Site officiel du BDE Mingo, bureau des étudiants de l'ESGI à Paris : événements, espace étudiant, identité de l'association et contact.",
  logo: "/site/logo-bde-mingo-trim.png",
  logoWidth: 718,
  logoHeight: 667,
  logoAlt:
    "Logo du BDE Mingo : mascotte flamant rose à lunettes de soleil sur un cercle bleu bordé de palmiers.",
} as const;

/** Link preview image. Declared explicitly: a page with its own openGraph block loses it. */
export const OG_IMAGE = {
  url: "/site/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Logo du BDE Mingo sur fond navy, avec l'adresse bde-mingo.fr.",
} as const;
