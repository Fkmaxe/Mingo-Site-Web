import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage() {
  if (await getMe()) redirect("/home");
  return (
    <AuthCard
      title="Créer un compte"
      description="Réservé aux élèves avec une adresse @myskolae.fr. Tu recevras un mail pour la confirmer."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Connecte-toi
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
