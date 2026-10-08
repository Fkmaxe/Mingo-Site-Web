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

export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport(smtpOptions(config));
  return {
    async send(mail: Mail) {
      await transport.sendMail({ from: config.MAIL_FROM, ...mail });
    },
  };
}
