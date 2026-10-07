CREATE TYPE "public"."open_points_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."open_points_status" AS ENUM('pending', 'validated', 'rejected', 'exported');--> statement-breakpoint
CREATE TABLE "open_points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"source" "open_points_source" NOT NULL,
	"attendance_id" uuid,
	"status" "open_points_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "open_points_ledger_attendance_unique" UNIQUE("attendance_id"),
	CONSTRAINT "open_points_ledger_delta_check" CHECK ("open_points_ledger"."delta" <> 0),
	CONSTRAINT "open_points_ledger_manual_reason_check" CHECK ("open_points_ledger"."source" <> 'manual' or length(trim("open_points_ledger"."reason")) > 0),
	CONSTRAINT "open_points_ledger_decision_check" CHECK (("open_points_ledger"."status" = 'pending') = ("open_points_ledger"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "open_points_ledger" ADD CONSTRAINT "open_points_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_points_ledger" ADD CONSTRAINT "open_points_ledger_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_points_ledger" ADD CONSTRAINT "open_points_ledger_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_points_ledger" ADD CONSTRAINT "open_points_ledger_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_points_ledger" ADD CONSTRAINT "open_points_ledger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "open_points_ledger_user_idx" ON "open_points_ledger" USING btree ("user_id","school_year_id");--> statement-breakpoint
CREATE INDEX "open_points_ledger_school_year_status_idx" ON "open_points_ledger" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE INDEX "open_points_ledger_decided_by_idx" ON "open_points_ledger" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "open_points_ledger_created_by_idx" ON "open_points_ledger" USING btree ("created_by");