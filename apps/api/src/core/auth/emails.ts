import type { Mail } from "../../lib/mailer";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(title: string, paragraphs: string[], action: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5">
<h1 style="font-size:20px">${escapeHtml(title)}</h1>${body}
<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p>
<p style="color:#666;font-size:13px">Si le bouton ne marche pas, copie ce lien : ${escapeHtml(action.url)}</p>
</body></html>`;
}

export function verificationEmail(user: { email: string; name: string }, url: string): Mail {
  const intro = `Salut ${user.name}, confirme ton adresse pour activer ton compte BDE Mingo.`;
  const outro = "Le lien est valable 1 heure. Si tu n'as pas créé de compte, ignore ce mail.";
  return {
    to: user.email,
    subject: "Confirme ton adresse — BDE Mingo",
    text: `${intro}\n\n${url}\n\n${outro}`,
    html: layout("Confirme ton adresse", [intro, outro], { label: "Confirmer mon adresse", url }),
  };
}

export function resetPasswordEmail(user: { email: string; name: string }, url: string): Mail {
  const intro = `Salut ${user.name}, tu as demandé à changer ton mot de passe BDE Mingo.`;
  const outro = "Le lien est valable 1 heure. Si ce n'est pas toi, ignore ce mail.";
  return {
    to: user.email,
    subject: "Réinitialise ton mot de passe — BDE Mingo",
    text: `${intro}\n\n${url}\n\n${outro}`,
    html: layout("Nouveau mot de passe", [intro, outro], {
      label: "Choisir un nouveau mot de passe",
      url,
    }),
  };
}
