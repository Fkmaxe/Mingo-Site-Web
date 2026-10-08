CREATE TYPE "public"."team_status" AS ENUM('confirmed', 'waitlisted');--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "status" "team_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "waitlist_position" integer;--> statement-breakpoint
CREATE INDEX "team_event_status_idx" ON "team" USING btree ("event_id","status");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_waitlist_position_check" CHECK (("team"."status" = 'waitlisted') = ("team"."waitlist_position" is not null));