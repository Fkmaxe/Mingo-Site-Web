import type { Mail } from "./mailer";

/** Content-ID of the logo, attached inline by the SMTP mailer (see smtp-mailer.ts). */
export const LOGO_CID = "logo@bde-mingo";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Brand colours, written out: mail clients ignore CSS variables and <style> blocks.
const BLUE = "#2653d8";
const NAVY = "#141a3a";
const PINK = "#fcf3f9";
const MUTED = "#6b6280";

/**
 * Builds a branded mail: plain text (unchanged, what filters read first) and an HTML version
 * with the BDE logo, the title, the paragraphs and one call-to-action button. Table layout and
 * inline styles only, for Outlook and Gmail.
 */
export function buildMail(params: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  /** One-time code, shown big and easy to copy (sign-in, address confirmation). */
  code?: string | undefined;
  action?: { label: string; url: string } | undefined;
}): Mail {
  const body = params.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${NAVY}">${escapeHtml(p)}</p>`,
    )
    .join("");
  const action = params.action;
  const url = action ? escapeHtml(action.url) : "";
  const code = params.code
    ? `<p style="margin:4px 0 20px;padding:14px 0;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace;color:${NAVY};background:${PINK};border-radius:12px">${escapeHtml(params.code)}</p>`
    : "";
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:999px;background:${BLUE}">
<a href="${url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(action.label)}</a>
</td></tr></table>
<p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${MUTED}">Si le bouton ne marche pas, copie ce lien : ${url}</p>`
    : "";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(params.subject)}</title></head>
<body style="margin:0;padding:0;background:${PINK};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PINK}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="background:${BLUE};background-image:linear-gradient(135deg,#c13a85,#6a3fb5 55%,${BLUE});padding:22px 16px">
<img src="cid:${LOGO_CID}" width="96" height="90" alt="BDE Mingo" style="display:block;border:0;width:96px;height:auto">
</td></tr>
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY}">${escapeHtml(params.title)}</h1>
${code}${body}${button}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #efe6f2;font-size:12px;color:${MUTED}">BDE Mingo · ESGI Paris</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    params.code ? `Code : ${params.code}` : null,
    ...params.paragraphs,
    action ? `${action.label} : ${action.url}` : null,
    "— BDE Mingo · ESGI Paris",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { to: params.to, subject: params.subject, text, html };
}
