import type { components } from "@/lib/api-schema";

export type League = components["schemas"]["League"];
export type EventLeague = components["schemas"]["EventLeague"];
export type Tournament = NonNullable<EventLeague["tournament"]>;
export type TournamentMatch = Tournament["pools"][number]["matches"][number];
export type MatchResult = "a" | "b" | "draw";
export type MyLeague = components["schemas"]["MyLeague"];
