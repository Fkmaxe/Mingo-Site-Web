import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form-field";
import { AuthCard } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <AuthCard
      title="Nouveau mot de passe"
      footer={
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Refaire une demande
        </Link>
      }
    >
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <FormAlert tone="error">Ce lien a expiré ou a déjà servi. Refais une demande.</FormAlert>
      )}
    </AuthCard>
  );
}
