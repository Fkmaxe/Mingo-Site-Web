CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled', 'done');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('public', 'students', 'members');--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pole_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"poster_url" text,
	"location" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"visibility" "event_visibility" NOT NULL,
	"capacity" integer,
	"registration_deadline" timestamp with time zone,
	"open_points_value" integer DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_dates_check" CHECK ("event"."ends_at" > "event"."starts_at"),
	CONSTRAINT "event_deadline_check" CHECK ("event"."registration_deadline" is null or "event"."registration_deadline" <= "event"."ends_at"),
	CONSTRAINT "event_capacity_check" CHECK ("event"."capacity" is null or "event"."capacity" > 0),
	CONSTRAINT "event_open_points_check" CHECK ("event"."open_points_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_pole_id_pole_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."pole"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_pole_id_idx" ON "event" USING btree ("pole_id");--> statement-breakpoint
CREATE INDEX "event_created_by_idx" ON "event" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "event_starts_at_idx" ON "event" USING btree ("starts_at","id");