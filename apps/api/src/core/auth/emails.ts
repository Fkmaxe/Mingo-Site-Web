import type { Mail } from "../../lib/mailer";
import { buildMail } from "../../lib/mailer/layout";

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

export type OtpPurpose = "sign-in" | "email-verification" | "forget-password" | "change-email";

/**
 * One-time code by mail: no link to click, which mail filters (Microsoft 365) flag far less
 * than "confirm your address" links. The code is in the subject, readable from the lock screen.
 */
export function otpEmail(email: string, otp: string, purpose: OtpPurpose): Mail {
  const signIn = purpose === "sign-in";
  return buildMail({
    to: email,
    subject: `${otp} est ton code ${signIn ? "de connexion" : "de confirmation"} BDE Mingo`,
    title: signIn ? "Ton code de connexion" : "Confirme ton adresse",
    code: otp,
    paragraphs: [
      signIn
        ? "Saisis ce code sur le site pour te connecter."
        : "Saisis ce code sur le site pour activer ton compte BDE Mingo.",
      "Il est valable 10 minutes. Si ce n'est pas toi, ignore ce mail : personne ne peut se connecter sans ce code.",
    ],
  });
}
