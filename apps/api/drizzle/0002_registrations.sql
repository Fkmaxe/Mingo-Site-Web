CREATE TYPE "public"."registration_status" AS ENUM('confirmed', 'waitlisted', 'cancelled');--> statement-breakpoint
CREATE TABLE "registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "registration_status" NOT NULL,
	"waitlist_position" integer,
	"qr_token" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "registration_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "registration_event_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "registration_cancelled_at_check" CHECK (("registration"."status" = 'cancelled') = ("registration"."cancelled_at" is not null)),
	CONSTRAINT "registration_waitlist_position_check" CHECK (("registration"."status" = 'waitlisted') = ("registration"."waitlist_position" is not null))
);
--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_user_id_idx" ON "registration" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registration_event_status_idx" ON "registration" USING btree ("event_id","status");