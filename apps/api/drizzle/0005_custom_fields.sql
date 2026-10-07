ALTER TABLE "event" ADD COLUMN "custom_fields_schema" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "registration" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;