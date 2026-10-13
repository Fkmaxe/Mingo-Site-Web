CREATE TABLE "class_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "level_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "track_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "class_level_name_unique" ON "class_level" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "track_name_unique" ON "track" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_level_id_class_level_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."class_level"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The free-text promos set so far become levels (one per name, case ignored); accounts keep it.
INSERT INTO "class_level" ("name", "position")
SELECT name, row_number() OVER (ORDER BY lower(name)) * 10
FROM (
  SELECT DISTINCT ON (lower(trim("promo"))) trim("promo") AS name
  FROM "user"
  WHERE "promo" IS NOT NULL AND trim("promo") <> ''
  ORDER BY lower(trim("promo")), trim("promo")
) AS promos;--> statement-breakpoint
UPDATE "user" u SET "level_id" = l."id", "promo" = l."name"
FROM "class_level" l
WHERE u."promo" IS NOT NULL AND lower(trim(u."promo")) = lower(l."name");
