-- Rollback for 2026-06-09-publications-table.sql.
-- NB: only safe where nothing depends on the table. The publish job and
-- /v1/list/meta both reference it, so dropping it re-introduces the 500.
DROP INDEX IF EXISTS idx_publications_version;
DROP TABLE IF EXISTS publications;
