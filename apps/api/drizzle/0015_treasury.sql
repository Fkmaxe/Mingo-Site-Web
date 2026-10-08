CREATE TABLE "event_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"budget_cents" integer NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "event_budget_event_unique" UNIQUE("event_id"),
	CONSTRAINT "event_budget_positive_check" CHECK ("event_budget"."budget_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treasury_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"event_id" uuid,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"receipt_url" text,
	"reversal_of_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "treasury_transaction_reversal_of_unique" UNIQUE("reversal_of_id"),
	CONSTRAINT "treasury_transaction_amount_check" CHECK ("treasury_transaction"."amount_cents" <> 0)
);
--> statement-breakpoint
ALTER TABLE "event_budget" ADD CONSTRAINT "event_budget_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_budget" ADD CONSTRAINT "event_budget_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_reversal_of_id_treasury_transaction_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."treasury_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction" ADD CONSTRAINT "treasury_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_budget_updated_by_idx" ON "event_budget" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "treasury_transaction_year_idx" ON "treasury_transaction" USING btree ("school_year_id","occurred_on");--> statement-breakpoint
CREATE INDEX "treasury_transaction_event_id_idx" ON "treasury_transaction" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "treasury_transaction_created_by_idx" ON "treasury_transaction" USING btree ("created_by");