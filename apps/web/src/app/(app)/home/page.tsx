import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Accueil" };

export default async function HomePage() {
  const me = await requireMe();
  const firstName = me.name.split(" ")[0];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Salut {firstName} 👋</h1>
      <Card>
        <CardTitle>Événements</CardTitle>
        <CardDescription>
          Les événements du BDE et tes billets arrivent ici très bientôt.
        </CardDescription>
      </Card>
    </div>
  );
}
