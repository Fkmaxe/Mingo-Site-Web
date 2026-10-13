CREATE TYPE "public"."study_rhythm" AS ENUM('initial', 'alternance');--> statement-breakpoint
CREATE TABLE "class_level_track" (
	"level_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	CONSTRAINT "class_level_track_level_id_track_id_pk" PRIMARY KEY("level_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "rhythm" "study_rhythm";--> statement-breakpoint
ALTER TABLE "class_level" ADD COLUMN "alternance_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_level_track" ADD CONSTRAINT "class_level_track_level_id_class_level_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."class_level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_level_track" ADD CONSTRAINT "class_level_track_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_level_track_track_id_idx" ON "class_level_track" USING btree ("track_id");--> statement-breakpoint
-- ESGI structure (administrators can change it): 1A to 5A; tronc commun or MCSI in 1A and 2A,
-- initial or work-study; from 3A on, a programme and work-study only. Missing names only.
INSERT INTO "class_level" ("name", "position")
SELECT v.name, v.position FROM (VALUES ('1A', 10), ('2A', 20), ('3A', 30), ('4A', 40), ('5A', 50)) AS v(name, position)
WHERE NOT EXISTS (SELECT 1 FROM "class_level" l WHERE lower(l."name") = lower(v.name));--> statement-breakpoint
INSERT INTO "track" ("name")
SELECT v.name FROM (VALUES ('Tronc commun'), ('MCSI'), ('Architecture logicielle'), ('Réseaux'), ('Sécurité')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "track" t WHERE lower(t."name") = lower(v.name));--> statement-breakpoint
UPDATE "class_level" SET "alternance_only" = true WHERE lower("name") IN ('3a', '4a', '5a');--> statement-breakpoint
INSERT INTO "class_level_track" ("level_id", "track_id")
SELECT l."id", t."id" FROM "class_level" l, "track" t
WHERE lower(l."name") IN ('1a', '2a') AND lower(t."name") IN ('tronc commun', 'mcsi')
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Programmes of 3A and later: every one except the tronc commun.
INSERT INTO "class_level_track" ("level_id", "track_id")
SELECT l."id", t."id" FROM "class_level" l, "track" t
WHERE l."alternance_only" AND lower(t."name") <> 'tronc commun'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "user" u SET "rhythm" = 'alternance'
FROM "class_level" l WHERE l."id" = u."level_id" AND l."alternance_only";
