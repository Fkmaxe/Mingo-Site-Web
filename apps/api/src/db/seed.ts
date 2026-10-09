import { splitName } from "@bde/shared";
import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull } from "drizzle-orm";
import { ensureDefaultRolePermissions } from "../core/permissions/defaults";
import type { DbOrTx } from "./client";
import { account, event, membership, pole, schoolYear, user } from "./schema";

export const SEED_SCHOOL_YEAR = {
  label: "2026-2027",
  startsOn: "2026-09-01",
  endsOn: "2027-08-31",
};

export const SEED_POLES = [
  { slug: "communication", name: "Communication" },
  { slug: "sport", name: "Sport" },
  { slug: "evenementiel", name: "Événementiel" },
  { slug: "partenariat", name: "Partenariat" },
] as const;

type SeedMembership =
  | { role: "member" | "pole_lead"; pole: (typeof SEED_POLES)[number]["slug"] }
  | { role: "board"; boardPosition: "president" | "vice_president" | "secretary" | "treasurer" };

type SeedUser = {
  email: string;
  name: string;
  promo?: string;
  isAdmin?: boolean;
  membership?: SeedMembership;
};

/** Password of every demo account. Dev data only, never seeded in production. */
export const SEED_PASSWORD = "mingo-demo-2026";

/** Fictitious demo accounts, one per role. */
export const SEED_USERS: SeedUser[] = [
  { email: "etudiant@myskolae.fr", name: "Camille Étudiante", promo: "3A" },
  {
    email: "membre.sport@myskolae.fr",
    name: "Léo Membre",
    promo: "2A",
    membership: { role: "member", pole: "sport" },
  },
  {
    email: "resp.sport@myskolae.fr",
    name: "Inès Responsable",
    promo: "3A",
    membership: { role: "pole_lead", pole: "sport" },
  },
  {
    email: "president@myskolae.fr",
    name: "Sam Président",
    promo: "4A",
    membership: { role: "board", boardPosition: "president" },
  },
  {
    email: "tresorier@myskolae.fr",
    name: "Alex Trésorier",
    promo: "4A",
    membership: { role: "board", boardPosition: "treasurer" },
  },
  { email: "admin@myskolae.fr", name: "Admin Technique", isAdmin: true },
];

const DAY = 24 * 3600 * 1000;

/** Demo events relative to the seeding date, so there is always something upcoming. */
function seedEvents(poleIdBySlug: Map<string, string>, now: number) {
  const at = (days: number, hour: number) => {
    const date = new Date(now + days * DAY);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };
  const poleId = (slug: string) => {
    const id = poleIdBySlug.get(slug);
    if (!id) throw new Error(`Seed: pôle ${slug} introuvable`);
    return id;
  };
  return [
    {
      slug: "soiree-d-integration",
      title: "Soirée d'intégration",
      poleId: poleId("evenementiel"),
      description: "La soirée de rentrée du BDE : DJ, quiz et surprises. Tenue correcte exigée.",
      location: "Le Petit Bain, Paris 13e",
      startsAt: at(7, 19),
      endsAt: at(8, 1),
      visibility: "students" as const,
      capacity: 150,
      openPointsValue: 2,
      status: "published" as const,
    },
    {
      slug: "tournoi-de-foot",
      title: "Tournoi de foot à 5",
      poleId: poleId("sport"),
      description:
        "Équipes de 5 joueurs, jusqu'à 2 remplaçants. Le capitaine crée l'équipe et partage son code.",
      location: "UrbanSoccer Porte d'Ivry",
      startsAt: at(14, 17),
      endsAt: at(14, 20),
      visibility: "public" as const,
      capacity: 8,
      teamMinSize: 5,
      teamMaxSize: 7,
      openPointsValue: 3,
      status: "published" as const,
    },
    {
      slug: "reunion-generale",
      title: "Réunion générale du BDE",
      poleId: poleId("communication"),
      description: "Bilan du mois et préparation des prochains événements.",
      location: "ESGI Paris, salle B12",
      startsAt: at(3, 17),
      endsAt: at(3, 19),
      visibility: "members" as const,
      capacity: null,
      openPointsValue: 0,
      status: "published" as const,
    },
    {
      slug: "afterwork-sport",
      title: "Afterwork sport (brouillon)",
      poleId: poleId("sport"),
      description: "",
      location: "À définir",
      startsAt: at(21, 18),
      endsAt: at(21, 21),
      visibility: "students" as const,
      capacity: 30,
      openPointsValue: 1,
      status: "draft" as const,
    },
  ];
}

/** Idempotent: running it twice leaves the database unchanged. */
export async function seed(db: DbOrTx, now: number = Date.now()) {
  await ensureDefaultRolePermissions(db);
  await db
    .insert(schoolYear)
    .values({ ...SEED_SCHOOL_YEAR, isCurrent: true })
    .onConflictDoNothing();
  const [year] = await db
    .select({ id: schoolYear.id })
    .from(schoolYear)
    .where(eq(schoolYear.label, SEED_SCHOOL_YEAR.label));
  if (!year) throw new Error("Seed: année scolaire introuvable");

  await db
    .insert(pole)
    .values([...SEED_POLES])
    .onConflictDoNothing();
  const poles = await db.select({ id: pole.id, slug: pole.slug }).from(pole);
  const poleIdBySlug = new Map(poles.map((p) => [p.slug, p.id]));

  const passwordHash = await hashPassword(SEED_PASSWORD);

  for (const seedUser of SEED_USERS) {
    await db
      .insert(user)
      .values({
        email: seedUser.email,
        name: seedUser.name,
        ...splitName(seedUser.name),
        promo: seedUser.promo ?? null,
        isAdmin: seedUser.isAdmin ?? false,
        emailVerified: true,
      })
      .onConflictDoNothing();
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, seedUser.email));
    if (!row) continue;

    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, row.id), eq(account.providerId, "credential")));
    if (!credential) {
      await db.insert(account).values({
        userId: row.id,
        accountId: row.id,
        providerId: "credential",
        password: passwordHash,
      });
    }

    if (!seedUser.membership) continue;

    const m = seedUser.membership;
    const poleId = m.role === "board" ? null : (poleIdBySlug.get(m.pole) ?? null);
    const [existing] = await db
      .select({ id: membership.id })
      .from(membership)
      .where(
        and(
          eq(membership.userId, row.id),
          eq(membership.schoolYearId, year.id),
          poleId === null ? isNull(membership.poleId) : eq(membership.poleId, poleId),
        ),
      );
    if (existing) continue;
    await db.insert(membership).values({
      userId: row.id,
      poleId,
      schoolYearId: year.id,
      role: m.role,
      boardPosition: m.role === "board" ? m.boardPosition : null,
    });
  }

  await db.insert(event).values(seedEvents(poleIdBySlug, now)).onConflictDoNothing();
}
