CREATE TYPE "public"."league_points_reason" AS ENUM('participation', 'placement', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('pools_bracket', 'pools', 'bracket');--> statement-breakpoint
CREATE TYPE "public"."tournament_phase" AS ENUM('pool', 'bracket', 'third_place');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('pools', 'bracket', 'done');--> statement-breakpoint
CREATE TABLE "league_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" "league_points_reason" NOT NULL,
	"place" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_points_nonzero_check" CHECK ("league_points"."points" <> 0)
);
--> statement-breakpoint
CREATE TABLE "league_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"place" integer NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_result_place_unique" UNIQUE("event_id","place"),
	CONSTRAINT "league_result_one_check" CHECK (("league_result"."user_id" is null) <> ("league_result"."team_id" is null)),
	CONSTRAINT "league_result_place_check" CHECK ("league_result"."place" >= 1)
);
--> statement-breakpoint
CREATE TABLE "league_season" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"name" text DEFAULT 'Ligue Sportive Interne' NOT NULL,
	"prizes" text DEFAULT '' NOT NULL,
	"placement_points" integer[] DEFAULT '{10,7,5,3,2}'::integer[] NOT NULL,
	"participation_points" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "league_season_school_year_unique" UNIQUE("school_year_id"),
	CONSTRAINT "league_season_participation_check" CHECK ("league_season"."participation_points" >= 0),
	CONSTRAINT "league_season_placement_points_check" CHECK (cardinality("league_season"."placement_points") between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"format" "tournament_format" NOT NULL,
	"pool_count" integer DEFAULT 0 NOT NULL,
	"qualifiers_per_pool" integer DEFAULT 0 NOT NULL,
	"third_place" boolean DEFAULT true NOT NULL,
	"status" "tournament_status" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "tournament_event_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_entrant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"seed" integer NOT NULL,
	"pool" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entrant_seed_unique" UNIQUE("tournament_id","seed"),
	CONSTRAINT "tournament_entrant_user_unique" UNIQUE("tournament_id","user_id"),
	CONSTRAINT "tournament_entrant_team_unique" UNIQUE("tournament_id","team_id"),
	CONSTRAINT "tournament_entrant_one_check" CHECK (("tournament_entrant"."user_id" is null) <> ("tournament_entrant"."team_id" is null))
);
--> statement-breakpoint
CREATE TABLE "tournament_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"phase" "tournament_phase" NOT NULL,
	"pool" integer,
	"round" integer NOT NULL,
	"position" integer NOT NULL,
	"entrant_a_id" uuid,
	"entrant_b_id" uuid,
	"winner_id" uuid,
	"draw" boolean DEFAULT false NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "tournament_match_draw_check" CHECK (not ("tournament_match"."draw" and "tournament_match"."winner_id" is not null)),
	CONSTRAINT "tournament_match_pool_check" CHECK (("tournament_match"."phase" = 'pool') = ("tournament_match"."pool" is not null) and ("tournament_match"."draw" = false or "tournament_match"."phase" = 'pool')),
	CONSTRAINT "tournament_match_scores_check" CHECK (("tournament_match"."score_a" is null) = ("tournament_match"."score_b" is null) and coalesce("tournament_match"."score_a", 0) >= 0 and coalesce("tournament_match"."score_b", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "sport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "league_sport_id" uuid;--> statement-breakpoint
ALTER TABLE "league_points" ADD CONSTRAINT "league_points_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_points" ADD CONSTRAINT "league_points_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_points" ADD CONSTRAINT "league_points_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_points" ADD CONSTRAINT "league_points_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_result" ADD CONSTRAINT "league_result_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_result" ADD CONSTRAINT "league_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_result" ADD CONSTRAINT "league_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_result" ADD CONSTRAINT "league_result_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_season" ADD CONSTRAINT "league_season_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrant" ADD CONSTRAINT "tournament_entrant_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrant" ADD CONSTRAINT "tournament_entrant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrant" ADD CONSTRAINT "tournament_entrant_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_entrant_a_id_tournament_entrant_id_fk" FOREIGN KEY ("entrant_a_id") REFERENCES "public"."tournament_entrant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_entrant_b_id_tournament_entrant_id_fk" FOREIGN KEY ("entrant_b_id") REFERENCES "public"."tournament_entrant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_winner_id_tournament_entrant_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."tournament_entrant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_points_year_user_idx" ON "league_points" USING btree ("school_year_id","user_id");--> statement-breakpoint
CREATE INDEX "league_points_event_user_idx" ON "league_points" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "league_points_user_id_idx" ON "league_points" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "league_points_created_by_idx" ON "league_points" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "league_result_user_id_idx" ON "league_result" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "league_result_team_id_idx" ON "league_result" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "league_result_created_by_idx" ON "league_result" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "tournament_created_by_idx" ON "tournament" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "tournament_entrant_user_id_idx" ON "tournament_entrant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tournament_entrant_team_id_idx" ON "tournament_entrant" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_slot_unique" ON "tournament_match" USING btree ("tournament_id","phase",coalesce("pool", -1),"round","position");--> statement-breakpoint
CREATE INDEX "tournament_match_entrant_a_idx" ON "tournament_match" USING btree ("entrant_a_id");--> statement-breakpoint
CREATE INDEX "tournament_match_entrant_b_idx" ON "tournament_match" USING btree ("entrant_b_id");--> statement-breakpoint
CREATE INDEX "tournament_match_winner_idx" ON "tournament_match" USING btree ("winner_id");--> statement-breakpoint
CREATE INDEX "tournament_match_updated_by_idx" ON "tournament_match" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "sport_name_unique" ON "sport" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_league_sport_id_sport_id_fk" FOREIGN KEY ("league_sport_id") REFERENCES "public"."sport"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_league_sport_id_idx" ON "event" USING btree ("league_sport_id");--> statement-breakpoint
-- New permission league:manage for the board. Only on existing installs: on a fresh install
-- the table is still empty here and the whole default mapping is inserted after the migrations.
INSERT INTO "role_permission" ("role", "permission")
SELECT 'board'::"app_role", 'league:manage'
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;--> statement-breakpoint
-- Sports of the league as announced (the board can add or rename them).
INSERT INTO "sport" ("name")
VALUES ('Tennis de table'), ('Badminton'), ('Five'), ('Padel'), ('Basket'), ('Paintball')
ON CONFLICT DO NOTHING;
