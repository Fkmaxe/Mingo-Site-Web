export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Outgoing mail. Implementations: SMTP in dev/prod, in-memory in tests. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}
