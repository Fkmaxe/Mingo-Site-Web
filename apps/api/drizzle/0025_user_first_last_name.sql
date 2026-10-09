-- First and last name are stored separately; "name" stays (Better Auth) as "First Last".
-- Existing accounts: first word of the name = first name, the rest = last name
-- (same rule as splitName in @bde/shared). Users can fix it from their profile.
ALTER TABLE "user" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name" text;--> statement-breakpoint
UPDATE "user"
SET
  "first_name" = split_part(regexp_replace(trim("name"), '\s+', ' ', 'g'), ' ', 1),
  "last_name" = trim(substr(
    regexp_replace(trim("name"), '\s+', ' ', 'g'),
    length(split_part(regexp_replace(trim("name"), '\s+', ' ', 'g'), ' ', 1)) + 1
  ));--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "last_name" SET NOT NULL;
