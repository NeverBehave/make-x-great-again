-- Backfill the `publications` table into environments that were built from
-- migrations only. It has always been in schema.sql, but never had a
-- migration, so D1 instances created/advanced via the migration path were
-- missing it. The public /v1/list/meta endpoint queries `publications` with
-- no error handling, so a missing table 500'd the endpoint in production.
--
-- Mirror of the definition in schema.sql. Idempotent (IF NOT EXISTS) so it's
-- a no-op on databases that already have it.
CREATE TABLE IF NOT EXISTS publications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  version       TEXT NOT NULL UNIQUE,       -- "v<sha256-prefix>-<count>"
  bloom_key     TEXT NOT NULL,              -- R2 object key for bloom filter
  json_key      TEXT NOT NULL,              -- R2 object key for shard JSON
  meta_key      TEXT NOT NULL,              -- R2 object key for meta.json
  count         INTEGER NOT NULL,           -- # of human_confirmed accounts
  published_at  INTEGER NOT NULL            -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_publications_version ON publications(version);
