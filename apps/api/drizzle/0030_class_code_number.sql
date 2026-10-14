ALTER TABLE "user" ADD COLUMN "class_number" smallint;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "january_intake" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_level" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "track" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_class_number_check" CHECK ("user"."class_number" between 1 and 9);--> statement-breakpoint
ALTER TABLE "class_level" ADD CONSTRAINT "class_level_code_check" CHECK ("class_level"."code" ~ '^[A-Z0-9]{1,6}$');--> statement-breakpoint
ALTER TABLE "track" ADD CONSTRAINT "track_code_check" CHECK ("track"."code" ~ '^[A-Z0-9]{1,6}$');--> statement-breakpoint
-- Codes of the ESGI class code (4AL1, 1A3, 2I8), editable by administrators. Years "1A" to "5A"
-- get their digit; the tronc commun keeps no code (the rhythm letter A / I is used instead).
-- No user has a class number yet: the stored labels do not change.
UPDATE "class_level" SET "code" = substring("name" from '^([0-9])[aA]$')
WHERE "code" IS NULL AND "name" ~ '^[0-9][aA]$';--> statement-breakpoint
UPDATE "track" t SET "code" = v.code
FROM (VALUES ('mcsi', 'MCSI'), ('architecture logicielle', 'AL'), ('réseaux', 'SRC'), ('sécurité', 'SI')) AS v(name, code)
WHERE t."code" IS NULL AND lower(t."name") = v.name;
