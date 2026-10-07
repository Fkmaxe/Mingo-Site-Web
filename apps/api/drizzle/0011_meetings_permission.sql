-- New permission meetings:manage for pole leads and the board.
-- Only on existing installs: on a fresh install the table is still empty here and the
-- whole default mapping (which already contains it) is inserted after the migrations.
INSERT INTO "role_permission" ("role", "permission")
SELECT r.role::"app_role", 'meetings:manage'
FROM (VALUES ('pole_lead'), ('board')) AS r(role)
WHERE EXISTS (SELECT 1 FROM "role_permission")
ON CONFLICT ("role", "permission") DO NOTHING;
