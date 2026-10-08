-- New permission budget:read for the board and the treasurer.
-- Only on existing installs (see apps/api/CLAUDE.md, "Ajouter une permission").
INSERT INTO "role_permission" ("role", "permission")
SELECT r.role::"app_role", 'budget:read'
FROM (VALUES ('board'), ('treasurer')) AS r(role)
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;
