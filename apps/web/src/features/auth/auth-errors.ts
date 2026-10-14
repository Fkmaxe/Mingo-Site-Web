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
  INVALID_NAME: "Indique ton prénom et ton nom.",
  PROFILE_UPDATE_NOT_ALLOWED: "Modifie ton profil depuis la page Profil.",
  INVALID_OTP: "Code incorrect. Vérifie le dernier mail reçu.",
  OTP_EXPIRED: "Ce code a expiré : demande-en un nouveau.",
  TOO_MANY_ATTEMPTS: "Trop d'essais : demande un nouveau code.",
  AUTH_CANCELLED: "Connexion par passkey annulée.",
  AUTHENTICATION_FAILED: "Cette passkey n'est pas reconnue. Connecte-toi autrement.",
  PASSKEY_NOT_FOUND: "Aucune passkey pour ce compte sur cet appareil.",
  ERROR_CEREMONY_ABORTED: "Connexion par passkey annulée.",
  ERROR_INVALID_DOMAIN: "Les passkeys ne fonctionnent pas sur cette adresse du site.",
  ERROR_INVALID_RP_ID: "Les passkeys ne fonctionnent pas sur cette adresse du site.",
  CHALLENGE_NOT_FOUND: "La demande a expiré. Réessaie.",
  REGISTRATION_CANCELLED: "Ajout de la passkey annulé.",
  PREVIOUSLY_REGISTERED: "Cet appareil a déjà une passkey sur ton compte.",
};

export type AuthError = { code?: string | undefined; status: number };

export function authErrorMessage(error: AuthError): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code] ?? "";
  if (error.status === 429) return "Trop de tentatives. Réessaie dans une minute.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}
