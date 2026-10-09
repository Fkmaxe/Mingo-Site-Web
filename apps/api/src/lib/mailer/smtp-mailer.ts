import nodemailer from "nodemailer";
import type { Env } from "../../env";
import type { Mail, Mailer } from "./mailer";

type SmtpConfig = Pick<
  Env,
  | "SMTP_HOST"
  | "SMTP_PORT"
  | "SMTP_SECURE"
  | "SMTP_USER"
  | "SMTP_PASSWORD"
  | "SMTP_EHLO_NAME"
  | "MAIL_FROM"
>;

/**
 * Name announced in the SMTP greeting (EHLO). Nodemailer defaults to the machine name, which in
 * Docker is a container id: relays such as smtp-relay.gmail.com refuse it (421 4.7.0). Default:
 * the domain of MAIL_FROM.
 */
export function ehloName(
  config: Pick<SmtpConfig, "SMTP_EHLO_NAME" | "MAIL_FROM">,
): string | undefined {
  if (config.SMTP_EHLO_NAME) return config.SMTP_EHLO_NAME;
  return config.MAIL_FROM.match(/@([a-z0-9.-]+\.[a-z]{2,})>?\s*$/i)?.[1]?.toLowerCase();
}

/** Nodemailer transport options, shared by the app and the `mail-test` command. */
export function smtpOptions(config: SmtpConfig) {
  const name = ehloName(config);
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    connectionTimeout: 15_000,
    ...(name ? { name } : {}),
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  };
}

/** "m***@myskolae.fr": enough to follow a mail in the logs, without the full address. */
export function maskAddress(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Every mail is logged (sent with the server's queue id, or failed), so a lost mail can be traced. */
export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport(smtpOptions(config));
  return {
    async send(mail: Mail) {
      const to = maskAddress(mail.to);
      try {
        const info = await transport.sendMail({ from: config.MAIL_FROM, ...mail });
        console.log(`Mail envoyé : « ${mail.subject} » → ${to} (${info.response})`);
      } catch (error) {
        console.error(`Mail en échec : « ${mail.subject} » → ${to}`, error);
        throw error;
      }
    },
  };
}
