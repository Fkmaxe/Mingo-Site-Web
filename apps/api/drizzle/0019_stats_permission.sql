-- New permission stats:read for the board (year overview, member involvement).
-- Only on existing installs (see apps/api/CLAUDE.md, "Ajouter une permission").
INSERT INTO "role_permission" ("role", "permission")
SELECT 'board'::"app_role", 'stats:read'
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;
