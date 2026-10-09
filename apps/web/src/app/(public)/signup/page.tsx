import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/auth-card";
import { authHref, safeNextPath } from "@/features/auth/safe-next";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getMe()) redirect(safeNextPath(next));
  return (
    <AuthCard
      title="Créer un compte"
      description="Réservé aux élèves de l'ESGI. Tu recevras un mail pour confirmer ton adresse."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link
            href={authHref("/login", next)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Connecte-toi
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
