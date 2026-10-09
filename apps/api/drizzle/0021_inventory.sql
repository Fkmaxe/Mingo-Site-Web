CREATE TYPE "public"."inventory_action" AS ENUM('created', 'updated', 'moved', 'condition_changed', 'quantity_adjusted', 'photo_changed', 'checked_out', 'returned', 'archived', 'restored');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('new', 'good', 'worn', 'damaged', 'broken');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('unique', 'stock');--> statement-breakpoint
CREATE TABLE "inventory_checkout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"holder" text NOT NULL,
	"event_id" uuid,
	"due_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"out_by" uuid,
	"returned_at" timestamp with time zone,
	"returned_by" uuid,
	"return_condition" "item_condition",
	CONSTRAINT "inventory_checkout_quantity_check" CHECK ("inventory_checkout"."quantity" > 0),
	CONSTRAINT "inventory_checkout_returned_check" CHECK (("inventory_checkout"."returned_at" is null) = ("inventory_checkout"."return_condition" is null))
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text,
	"kind" "item_kind" DEFAULT 'unique' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"condition" "item_condition" DEFAULT 'good' NOT NULL,
	"location_id" uuid,
	"pole_id" uuid,
	"photo" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "inventory_item_number_unique" UNIQUE("number"),
	CONSTRAINT "inventory_item_quantity_check" CHECK ("inventory_item"."quantity" >= 0),
	CONSTRAINT "inventory_item_unique_quantity_check" CHECK ("inventory_item"."kind" = 'stock' or "inventory_item"."quantity" = 1)
);
--> statement-breakpoint
CREATE TABLE "inventory_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"action" "inventory_action" NOT NULL,
	"actor_user_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_checkout" ADD CONSTRAINT "inventory_checkout_item_id_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_checkout" ADD CONSTRAINT "inventory_checkout_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_checkout" ADD CONSTRAINT "inventory_checkout_out_by_user_id_fk" FOREIGN KEY ("out_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_checkout" ADD CONSTRAINT "inventory_checkout_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_location_id_inventory_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_pole_id_pole_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."pole"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_item_id_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_checkout_item_id_idx" ON "inventory_checkout" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "inventory_checkout_open_idx" ON "inventory_checkout" USING btree ("item_id") WHERE "inventory_checkout"."returned_at" is null;--> statement-breakpoint
CREATE INDEX "inventory_item_location_id_idx" ON "inventory_item" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "inventory_item_pole_id_idx" ON "inventory_item" USING btree ("pole_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_name_unique" ON "inventory_location" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "inventory_movement_item_id_idx" ON "inventory_movement" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movement_created_at_idx" ON "inventory_movement" USING btree ("created_at");