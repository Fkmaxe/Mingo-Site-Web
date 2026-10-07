CREATE TYPE "public"."application_status" AS ENUM('new', 'interview', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"wished_pole_id" uuid NOT NULL,
	"motivation" text NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "application_user_year_unique" UNIQUE("user_id","school_year_id")
);
--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_wished_pole_id_pole_id_fk" FOREIGN KEY ("wished_pole_id") REFERENCES "public"."pole"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_school_year_status_idx" ON "application" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE INDEX "application_wished_pole_id_idx" ON "application" USING btree ("wished_pole_id");--> statement-breakpoint
CREATE INDEX "application_decided_by_idx" ON "application" USING btree ("decided_by");