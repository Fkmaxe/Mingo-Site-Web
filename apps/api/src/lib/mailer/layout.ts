import type { Mail } from "./mailer";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Builds a branded mail: plain text and HTML with one call-to-action button. */
export function buildMail(params: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  action: { label: string; url: string };
}): Mail {
  const body = params.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const html = `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5">
<h1 style="font-size:20px">${escapeHtml(params.title)}</h1>${body}
<p><a href="${escapeHtml(params.action.url)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(params.action.label)}</a></p>
<p style="color:#666;font-size:13px">Si le bouton ne marche pas, copie ce lien : ${escapeHtml(params.action.url)}</p>
</body></html>`;
  const text = `${params.paragraphs.join("\n\n")}\n\n${params.action.label} : ${params.action.url}`;
  return { to: params.to, subject: params.subject, text, html };
}
