import { isPending, pending } from "./pending";
import type { SocialLink } from "./types";

/** An unconfirmed link is never rendered: no dead link, no button leading nowhere. */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/bde.mingo" },
  // Official account of the BDE Mingo; its handle has not been renamed yet.
  { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@bde.sigma" },
  { id: "discord", label: "Discord", url: pending("Aucun serveur Discord public pour le moment.") },
];

/** Looked up by id, never by position: reordering the array must not swap links. */
function socialById(id: string): SocialLink {
  const link = SOCIAL_LINKS.find((entry) => entry.id === id);
  if (!link) throw new Error(`Réseau « ${id} » absent de SOCIAL_LINKS.`);
  return link;
}

export const DISCORD: SocialLink = socialById("discord");

export const confirmedSocialLinks = (): readonly SocialLink[] =>
  SOCIAL_LINKS.filter((link) => !isPending(link.url));

/** Caption under a social link: the account's owner, never its legacy handle. */
export function socialCaption(link: SocialLink): string {
  return `${link.label} du BDE Mingo`;
}
