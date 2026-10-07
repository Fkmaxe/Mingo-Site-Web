import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";

export function verificationEmail(user: { email: string; name: string }, url: string): Mail {
  return buildMail({
    to: user.email,
    subject: "Confirme ton adresse — BDE Mingo",
    title: "Confirme ton adresse",
    paragraphs: [
      `Salut ${user.name}, confirme ton adresse pour activer ton compte BDE Mingo.`,
      "Le lien est valable 1 heure. Si tu n'as pas créé de compte, ignore ce mail.",
    ],
    action: { label: "Confirmer mon adresse", url },
  });
}

export function resetPasswordEmail(user: { email: string; name: string }, url: string): Mail {
  return buildMail({
    to: user.email,
    subject: "Réinitialise ton mot de passe — BDE Mingo",
    title: "Nouveau mot de passe",
    paragraphs: [
      `Salut ${user.name}, tu as demandé à changer ton mot de passe BDE Mingo.`,
      "Le lien est valable 1 heure. Si ce n'est pas toi, ignore ce mail.",
    ],
    action: { label: "Choisir un nouveau mot de passe", url },
  });
}
