-- New permissions inventory:manage (every member) and inventory:archive (pole leads, board).
-- Only on existing installs (see apps/api/CLAUDE.md, "Ajouter une permission").
INSERT INTO "role_permission" ("role", "permission")
SELECT r.role::"app_role", r.permission
FROM (VALUES
  ('member', 'inventory:manage'),
  ('pole_lead', 'inventory:archive'),
  ('board', 'inventory:archive')
) AS r(role, permission)
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;
