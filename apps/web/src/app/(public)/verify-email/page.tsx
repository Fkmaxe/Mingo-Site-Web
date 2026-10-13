import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form-field";
import { AuthCard } from "@/features/auth/auth-card";
import { authHref } from "@/features/auth/safe-next";
import { VerifyEmailCode } from "@/features/auth/verify-email-code";

export const metadata: Metadata = { title: "Confirme ton adresse" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; resent?: string }>;
}) {
  const { email, next, resent } = await searchParams;
  return (
    <AuthCard
      title="Regarde tes mails"
      description={
        email
          ? `On a envoyé un code à 6 chiffres à ${email}.`
          : "On t'a envoyé un code à 6 chiffres."
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
          Ton adresse n'est pas encore confirmée : on vient de t'envoyer un nouveau code.
        </FormAlert>
      ) : null}
      <p className="text-sm">
        Saisis le code du mail pour activer ton compte : tu seras connecté directement. Il est
        valable 10 minutes. Pense à regarder dans les indésirables.
      </p>
      <VerifyEmailCode email={email} next={next} />
    </AuthCard>
  );
}
