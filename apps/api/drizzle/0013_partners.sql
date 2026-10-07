CREATE TYPE "public"."partner_status" AS ENUM('prospect', 'contacted', 'negotiating', 'active', 'ended');--> statement-breakpoint
CREATE TABLE "partner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text,
	"status" "partner_status" DEFAULT 'prospect' NOT NULL,
	"benefits" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"owner_membership_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_owner_membership_id_membership_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_status_idx" ON "partner" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partner_owner_membership_id_idx" ON "partner" USING btree ("owner_membership_id");--> statement-breakpoint
CREATE INDEX "partner_created_by_idx" ON "partner" USING btree ("created_by");