CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"captain_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "team_min_size" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "team_max_size" integer;--> statement-breakpoint
ALTER TABLE "registration" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_captain_user_id_user_id_fk" FOREIGN KEY ("captain_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_event_name_unique" ON "team" USING btree ("event_id",lower("name"));--> statement-breakpoint
CREATE INDEX "team_captain_user_id_idx" ON "team" USING btree ("captain_user_id");--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_team_id_idx" ON "registration" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_team_size_check" CHECK (("event"."team_min_size" is null and "event"."team_max_size" is null) or ("event"."team_min_size" >= 1 and "event"."team_max_size" >= "event"."team_min_size"));