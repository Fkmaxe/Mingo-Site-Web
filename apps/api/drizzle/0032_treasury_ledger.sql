CREATE TYPE "public"."treasury_kind" AS ENUM('debit', 'credit', 'other');--> statement-breakpoint
CREATE TABLE "treasury_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_attachment_file_name_unique" UNIQUE("file_name"),
	CONSTRAINT "treasury_attachment_size_check" CHECK ("treasury_attachment"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD COLUMN "initiator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD COLUMN "kind" "treasury_kind";--> statement-breakpoint
-- Existing entries: the sign gives the kind; a reversal keeps the kind of the entry it cancels.
UPDATE "treasury_transaction" SET "kind" = CASE WHEN "amount_cents" > 0 THEN 'credit'::"treasury_kind" ELSE 'debit'::"treasury_kind" END
WHERE "reversal_of_id" IS NULL;--> statement-breakpoint
UPDATE "treasury_transaction" r SET "kind" = o."kind"
FROM "treasury_transaction" o WHERE o."id" = r."reversal_of_id";--> statement-breakpoint
ALTER TABLE "treasury_transaction" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD COLUMN "other_label" text;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD COLUMN "comment" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "treasury_attachment" ADD CONSTRAINT "treasury_attachment_transaction_id_treasury_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."treasury_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_attachment" ADD CONSTRAINT "treasury_attachment_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasury_attachment_transaction_id_idx" ON "treasury_attachment" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "treasury_attachment_uploaded_by_idx" ON "treasury_attachment" USING btree ("uploaded_by");--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_initiator_user_id_user_id_fk" FOREIGN KEY ("initiator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasury_transaction_initiator_user_id_idx" ON "treasury_transaction" USING btree ("initiator_user_id");--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_other_label_check" CHECK (("treasury_transaction"."kind" = 'other') = ("treasury_transaction"."other_label" is not null));--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_kind_sign_check" CHECK ("treasury_transaction"."reversal_of_id" is not null or "treasury_transaction"."kind" = 'other'
        or ("treasury_transaction"."kind" = 'debit' and "treasury_transaction"."amount_cents" < 0)
        or ("treasury_transaction"."kind" = 'credit' and "treasury_transaction"."amount_cents" > 0));