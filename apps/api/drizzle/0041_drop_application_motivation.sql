ALTER TABLE "application" DROP CONSTRAINT "application_wished_pole_id_pole_id_fk";
--> statement-breakpoint
DROP INDEX "application_wished_pole_id_idx";--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "questions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "answers" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "application" DROP COLUMN "wished_pole_id";--> statement-breakpoint
ALTER TABLE "application" DROP COLUMN "motivation";