import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormAlert } from "@/components/form-field";
import { AuthCard } from "@/features/auth/auth-card";
import { authHref, safeNextPath } from "@/features/auth/safe-next";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string }>;
}) {
  const { reset, next } = await searchParams;
  if (await getMe()) redirect(safeNextPath(next));
  return (
    <AuthCard
      title="Connexion"
      description="Billets, points open, espace membre : tout est là."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href={authHref("/signup", next)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Crée-le en 1 minute
          </Link>
        </>
      }
    >
      {reset ? (
        <FormAlert tone="success">Mot de passe changé. Tu peux te connecter.</FormAlert>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
