CREATE TYPE "public"."grade_status" AS ENUM('draft', 'submitted', 'validated', 'published');--> statement-breakpoint
CREATE TABLE "grade_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"label" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"scale_max" integer DEFAULT 20 NOT NULL,
	"points_per_presence" numeric(7, 2) DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "grade_period_dates_check" CHECK ("grade_period"."ends_on" >= "grade_period"."starts_on"),
	CONSTRAINT "grade_period_scale_check" CHECK ("grade_period"."scale_max" > 0),
	CONSTRAINT "grade_period_points_check" CHECK ("grade_period"."points_per_presence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "member_grade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"grade_period_id" uuid NOT NULL,
	"involvement_points" numeric(7, 2) DEFAULT 0 NOT NULL,
	"presence_points" numeric(7, 2),
	"final_score" numeric(7, 2),
	"comment" text DEFAULT '' NOT NULL,
	"status" "grade_status" DEFAULT 'draft' NOT NULL,
	"proposed_by" uuid,
	"validated_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "member_grade_membership_period_unique" UNIQUE("membership_id","grade_period_id"),
	CONSTRAINT "member_grade_involvement_check" CHECK ("member_grade"."involvement_points" >= 0),
	CONSTRAINT "member_grade_snapshot_check" CHECK ("member_grade"."status" in ('draft', 'submitted') or ("member_grade"."presence_points" is not null and "member_grade"."final_score" is not null))
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "member_points" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "grade_period" ADD CONSTRAINT "grade_period_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_grade" ADD CONSTRAINT "member_grade_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_grade" ADD CONSTRAINT "member_grade_grade_period_id_grade_period_id_fk" FOREIGN KEY ("grade_period_id") REFERENCES "public"."grade_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_grade" ADD CONSTRAINT "member_grade_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_grade" ADD CONSTRAINT "member_grade_validated_by_user_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grade_period_school_year_id_idx" ON "grade_period" USING btree ("school_year_id");--> statement-breakpoint
CREATE INDEX "member_grade_grade_period_id_idx" ON "member_grade" USING btree ("grade_period_id");--> statement-breakpoint
CREATE INDEX "member_grade_proposed_by_idx" ON "member_grade" USING btree ("proposed_by");--> statement-breakpoint
CREATE INDEX "member_grade_validated_by_idx" ON "member_grade" USING btree ("validated_by");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_member_points_check" CHECK ("event"."member_points" is null or "event"."member_points" >= 0);