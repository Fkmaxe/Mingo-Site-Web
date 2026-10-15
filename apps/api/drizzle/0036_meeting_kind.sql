CREATE TYPE "public"."meeting_kind" AS ENUM('pole', 'general', 'board', 'leads');--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "kind" "meeting_kind";--> statement-breakpoint
UPDATE "meeting" SET "kind" = CASE WHEN "pole_id" IS NULL THEN 'general'::"meeting_kind" ELSE 'pole'::"meeting_kind" END;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_pole_kind_check" CHECK (("meeting"."kind" = 'pole') = ("meeting"."pole_id" is not null));
