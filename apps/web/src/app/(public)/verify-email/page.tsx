import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/features/auth/auth-card";

export const metadata: Metadata = { title: "Confirme ton adresse" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Regarde tes mails"
      description={
        email
          ? `On a envoyé un lien de confirmation à ${email}.`
          : "On t'a envoyé un lien de confirmation."
      }
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <p className="text-sm">
        Clique sur le lien du mail pour activer ton compte. Il est valable 1 heure. Pense à regarder
        dans les spams.
      </p>
    </AuthCard>
  );
}
