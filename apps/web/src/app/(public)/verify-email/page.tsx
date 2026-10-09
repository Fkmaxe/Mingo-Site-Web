import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form-field";
import { AuthCard } from "@/features/auth/auth-card";
import { ResendVerificationButton } from "@/features/auth/resend-verification-button";
import { ResendVerificationForm } from "@/features/auth/resend-verification-form";
import { authHref, safeNextPath } from "@/features/auth/safe-next";

export const metadata: Metadata = { title: "Confirme ton adresse" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; resent?: string }>;
}) {
  const { email, next, resent } = await searchParams;
  const callbackURL = safeNextPath(next);
  return (
    <AuthCard
      title="Regarde tes mails"
      description={
        email
          ? `On a envoyé un lien de confirmation à ${email}.`
          : "On t'a envoyé un lien de confirmation."
      }
      footer={
        <Link
          href={authHref("/login", next)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      }
    >
      {resent ? (
        <FormAlert tone="success">
          Ton adresse n'est pas encore confirmée : on vient de te renvoyer le mail.
        </FormAlert>
      ) : null}
      <p className="text-sm">
        Clique sur le lien du mail pour activer ton compte : tu seras connecté directement. Il est
        valable 1 heure. Pense à regarder dans les spams.
      </p>
      {email ? (
        <ResendVerificationButton email={email} callbackURL={callbackURL} />
      ) : (
        <ResendVerificationForm callbackURL={callbackURL} />
      )}
    </AuthCard>
  );
}
