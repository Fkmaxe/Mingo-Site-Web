import nodemailer from "nodemailer";
import type { Env } from "../../env";
import type { Mail, Mailer } from "./mailer";

type SmtpConfig = Pick<
  Env,
  "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_USER" | "SMTP_PASSWORD" | "MAIL_FROM"
>;

export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  });
  return {
    async send(mail: Mail) {
      await transport.sendMail({ from: config.MAIL_FROM, ...mail });
    },
  };
}
