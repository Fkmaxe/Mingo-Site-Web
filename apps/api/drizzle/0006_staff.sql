CREATE TYPE "public"."staff_assignment_status" AS ENUM('proposed', 'validated', 'declined');--> statement-breakpoint
CREATE TABLE "staff_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_slot_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"status" "staff_assignment_status" DEFAULT 'proposed' NOT NULL,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "staff_assignment_slot_membership_unique" UNIQUE("staff_slot_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "staff_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "staff_slot_dates_check" CHECK ("staff_slot"."ends_at" > "staff_slot"."starts_at"),
	CONSTRAINT "staff_slot_capacity_check" CHECK ("staff_slot"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "staff_assignment" ADD CONSTRAINT "staff_assignment_staff_slot_id_staff_slot_id_fk" FOREIGN KEY ("staff_slot_id") REFERENCES "public"."staff_slot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignment" ADD CONSTRAINT "staff_assignment_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignment" ADD CONSTRAINT "staff_assignment_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_slot" ADD CONSTRAINT "staff_slot_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_assignment_membership_id_idx" ON "staff_assignment" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "staff_assignment_decided_by_idx" ON "staff_assignment" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "staff_slot_event_id_idx" ON "staff_slot" USING btree ("event_id");