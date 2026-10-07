-- New permission partners:manage for the board.
-- Only on existing installs (see apps/api/CLAUDE.md, "Ajouter une permission").
INSERT INTO "role_permission" ("role", "permission")
SELECT 'board'::"app_role", 'partners:manage'
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;
