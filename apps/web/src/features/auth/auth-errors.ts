import { ALLOWED_EMAIL_DOMAIN } from "@bde/shared";

/** Better Auth answers in English: map its stable codes to French messages. */
const MESSAGES: Record<string, string> = {
  DOMAIN_NOT_ALLOWED: `Seules les adresses @${ALLOWED_EMAIL_DOMAIN} peuvent créer un compte.`,
  EMAIL_NOT_VERIFIED:
    "Ton adresse n'est pas encore confirmée. On vient de te renvoyer le mail de confirmation.",
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  INVALID_EMAIL: "Adresse email invalide.",
  PASSWORD_TOO_SHORT: "Le mot de passe est trop court.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  INVALID_TOKEN: "Ce lien a expiré ou a déjà servi. Refais une demande.",
};

export type AuthError = { code?: string | undefined; status: number };

export function authErrorMessage(error: AuthError): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code] ?? "";
  if (error.status === 429) return "Trop de tentatives. Réessaie dans une minute.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}
