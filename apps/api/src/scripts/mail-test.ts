// Checks the SMTP settings of .env and sends a test mail, with a readable diagnosis.
//   dev    : pnpm --filter api mail:test toi@exemple.fr
//   Docker : docker compose exec api node dist/mail-test.js toi@exemple.fr
import nodemailer from "nodemailer";
import { z } from "zod";
import { loadEnv } from "../env";
import { smtpOptions } from "../lib/mailer/smtp-mailer";

const SmtpFailure = z.object({
  code: z.string().optional(),
  responseCode: z.number().optional(),
  response: z.string().optional(),
  message: z.string(),
});

/** What the failure most likely means, in French. */
export function diagnose(error: unknown, secure: boolean, port: number): string {
  const parsed = SmtpFailure.safeParse(error);
  if (!parsed.success) return "Erreur inconnue.";
  const { code, responseCode, message } = parsed.data;
  if (/wrong version number|ssl3_get_record|EPROTO/i.test(message)) {
    return secure
      ? `SMTP_SECURE=true mais le port ${port} attend STARTTLS : mets SMTP_SECURE=false (587) ou le port 465.`
      : `Le port ${port} attend du TLS direct : mets SMTP_SECURE=true (465).`;
  }
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ESOCKET") {
    return `Connexion impossible à ${port} : hôte faux, ou port sortant bloqué par l'hébergeur / la box (essaie 465 ou 587).`;
  }
  if (code === "EDNS" || code === "ENOTFOUND")
    return "Nom du serveur SMTP introuvable : vérifie SMTP_HOST.";
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return "Identifiants refusés : vérifie SMTP_USER et SMTP_PASSWORD (Gmail : mot de passe d'application).";
  }
  if (responseCode === 421) {
    return "Le serveur refuse la connexion (421) : relais non autorisé pour ce compte ou cette IP, ou trop de tentatives.";
  }
  if (responseCode === 501 || /5\.1\.7/.test(parsed.data.response ?? message)) {
    return "Adresse invalide : vérifie MAIL_FROM (ex. « BDE Mingo <contact@ton-domaine.fr> ») et l'adresse de destination.";
  }
  if (responseCode === 550 || responseCode === 553 || responseCode === 554) {
    return "Expéditeur ou destinataire refusé : MAIL_FROM doit être une adresse que ce compte SMTP a le droit d'utiliser.";
  }
  return "Voir le message du serveur ci-dessus.";
}

async function main() {
  const to = process.argv[2];
  if (!to || !z.email().safeParse(to).success) {
    console.error("Usage : mail-test <adresse de destination>");
    process.exit(2);
  }
  const env = loadEnv();
  const options = smtpOptions(env);
  console.log("Configuration SMTP :");
  console.log(
    `  serveur    ${options.host}:${options.port} (${options.secure ? "TLS direct" : "STARTTLS"})`,
  );
  console.log(
    `  compte     ${env.SMTP_USER || "(aucun)"}  mot de passe ${env.SMTP_PASSWORD ? "renseigné" : "absent"}`,
  );
  console.log(`  EHLO       ${options.name ?? "(nom de la machine)"}`);
  console.log(`  expéditeur ${env.MAIL_FROM}`);

  const transport = nodemailer.createTransport(options);
  try {
    await transport.verify();
    console.log("✔ Connexion et authentification OK");
    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: "Test d'envoi : BDE Mingo",
      text: "Si tu lis ce mail, l'envoi depuis le serveur fonctionne.",
    });
    console.log(`✔ Mail accepté par le serveur (${info.response})`);
    console.log(
      "  Pas reçu ? Regarde les indésirables, puis la configuration SPF/DKIM du domaine.",
    );
  } catch (error) {
    console.error("✘ Échec :", error instanceof Error ? error.message : error);
    console.error(`  → ${diagnose(error, options.secure, options.port)}`);
    process.exit(1);
  }
}

if (process.argv[1]?.match(/mail-test\.(ts|js)$/)) void main();
