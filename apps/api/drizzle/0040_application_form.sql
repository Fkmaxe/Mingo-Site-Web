CREATE TABLE "application_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"requirement_key" text NOT NULL,
	"file_name" text,
	"original_name" text,
	"content_type" text,
	"size_bytes" integer,
	"link_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_document_file_name_unique" UNIQUE("file_name"),
	CONSTRAINT "application_document_requirement_unique" UNIQUE("application_id","requirement_key"),
	CONSTRAINT "application_document_file_or_link_check" CHECK (("application_document"."file_name" is null) <> ("application_document"."link_url" is null))
);
--> statement-breakpoint
CREATE TABLE "application_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"closes_at" timestamp with time zone,
	"intro" text DEFAULT '' NOT NULL,
	"max_wishes" integer DEFAULT 1 NOT NULL,
	"all_poles_recruiting" boolean DEFAULT true NOT NULL,
	"fields" jsonb DEFAULT '[{"key":"motivation","label":"Pourquoi veux-tu rejoindre le BDE ?","description":"Ce que tu aimerais faire, tes disponibilités…","type":"longtext","required":true}]'::jsonb NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "application_form_school_year_unique" UNIQUE("school_year_id"),
	CONSTRAINT "application_form_max_wishes_check" CHECK ("application_form"."max_wishes" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "application_form_pole" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"pole_id" uuid NOT NULL,
	CONSTRAINT "application_form_pole_unique" UNIQUE("form_id","pole_id")
);
--> statement-breakpoint
CREATE TABLE "application_wish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"pole_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "application_wish_rank_unique" UNIQUE("application_id","rank"),
	CONSTRAINT "application_wish_pole_unique" UNIQUE("application_id","pole_id")
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "questions" jsonb;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "document_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ADD CONSTRAINT "application_document_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form" ADD CONSTRAINT "application_form_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form" ADD CONSTRAINT "application_form_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form_pole" ADD CONSTRAINT "application_form_pole_form_id_application_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."application_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form_pole" ADD CONSTRAINT "application_form_pole_pole_id_pole_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."pole"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_wish" ADD CONSTRAINT "application_wish_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_wish" ADD CONSTRAINT "application_wish_pole_id_pole_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."pole"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_form_updated_by_idx" ON "application_form" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "application_form_pole_pole_id_idx" ON "application_form_pole" USING btree ("pole_id");--> statement-breakpoint
CREATE INDEX "application_wish_pole_id_idx" ON "application_wish" USING btree ("pole_id");--> statement-breakpoint
INSERT INTO "application_wish" ("application_id", "pole_id", "rank")
SELECT "id", "wished_pole_id", 1 FROM "application";--> statement-breakpoint
UPDATE "application" SET
  "answers" = jsonb_build_object('motivation', "motivation"),
  "questions" = '[{"key":"motivation","label":"Pourquoi veux-tu rejoindre le BDE ?","description":"Ce que tu aimerais faire, tes disponibilités…","type":"longtext","required":true}]'::jsonb;
