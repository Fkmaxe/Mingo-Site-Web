import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/auth-card";
import { FormAlert } from "@/features/auth/form-field";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getMe()) redirect("/home");
  const { reset } = await searchParams;
  return (
    <AuthCard
      title="Connexion"
      description="Avec ton adresse @myskolae.fr."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Crée-le
          </Link>
        </>
      }
    >
      {reset ? (
        <FormAlert tone="success">Mot de passe changé. Tu peux te connecter.</FormAlert>
      ) : null}
      <SignInForm />
    </AuthCard>
  );
}
