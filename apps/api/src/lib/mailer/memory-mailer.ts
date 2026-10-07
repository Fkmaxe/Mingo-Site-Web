import type { Mail, Mailer } from "./mailer";

export type MemoryMailer = Mailer & { sent: Mail[]; lastTo(to: string): Mail | undefined };

/** Test double: keeps mails in memory instead of sending them. */
export function createMemoryMailer(): MemoryMailer {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
    lastTo(to) {
      return sent.findLast((mail) => mail.to === to);
    },
  };
}
