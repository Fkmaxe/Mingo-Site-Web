CREATE TABLE "inventory_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_item" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_category_name_unique" ON "inventory_category" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_category_id_inventory_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_item_category_id_idx" ON "inventory_item" USING btree ("category_id");--> statement-breakpoint
-- Free-text categories typed so far become list entries (one per name, case ignored).
INSERT INTO "inventory_category" ("name")
SELECT DISTINCT ON (lower(trim("category"))) trim("category")
FROM "inventory_item"
WHERE "category" IS NOT NULL AND trim("category") <> ''
ORDER BY lower(trim("category")), trim("category");--> statement-breakpoint
UPDATE "inventory_item" i SET "category_id" = c."id"
FROM "inventory_category" c
WHERE i."category" IS NOT NULL AND lower(trim(i."category")) = lower(c."name");
