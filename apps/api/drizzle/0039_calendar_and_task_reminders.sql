CREATE TABLE "calendar_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone,
	CONSTRAINT "calendar_feed_user_unique" UNIQUE("user_id"),
	CONSTRAINT "calendar_feed_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "reminder_sent_for" date;--> statement-breakpoint
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;