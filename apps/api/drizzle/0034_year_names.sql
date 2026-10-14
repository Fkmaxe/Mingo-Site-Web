-- Years "1A" to "5A" become "1" to "5": the A was read as « alternance », which is chosen
-- separately (initial / alternance). Only names left as created; a name already taken stays.
UPDATE "class_level" l SET "name" = substring(l."name" from '^([1-5])[aA]$')
WHERE l."name" ~ '^[1-5][aA]$'
  AND NOT EXISTS (
    SELECT 1 FROM "class_level" o WHERE o."name" = substring(l."name" from '^([1-5])[aA]$')
  );--> statement-breakpoint
-- Class label of every student with a year, same rule as refreshPromo (classes.repo.ts).
UPDATE "user" u SET "promo" = nullif(concat_ws(' · ',
    CASE WHEN u."class_number" IS NOT NULL THEN
      (SELECT l."code" FROM "class_level" l WHERE l."id" = u."level_id")
      || CASE WHEN coalesce((SELECT l."alternance_only" FROM "class_level" l WHERE l."id" = u."level_id"), false)
        THEN coalesce((SELECT t."code" FROM "track" t WHERE t."id" = u."track_id"),
          CASE u."rhythm" WHEN 'alternance' THEN 'A' WHEN 'initial' THEN 'I' ELSE '' END)
        ELSE CASE u."rhythm" WHEN 'alternance' THEN 'A' WHEN 'initial' THEN 'I' ELSE '' END END
      || u."class_number"::text END,
    (SELECT l."name" FROM "class_level" l WHERE l."id" = u."level_id"),
    (SELECT t."name" FROM "track" t WHERE t."id" = u."track_id"),
    CASE WHEN coalesce((SELECT l."alternance_only" FROM "class_level" l WHERE l."id" = u."level_id"), false) THEN NULL
      WHEN u."rhythm" = 'initial' THEN 'Initial'
      WHEN u."rhythm" = 'alternance' THEN 'Alternance' END,
    CASE WHEN u."january_intake" AND u."level_id" IS NOT NULL THEN 'Rentrée de janvier' END), '')
WHERE u."level_id" IS NOT NULL;
