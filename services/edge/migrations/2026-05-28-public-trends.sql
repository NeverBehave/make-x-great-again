-- Speed up public count/window queries used by /v1/list/meta and /v1/list/trends.
CREATE INDEX IF NOT EXISTS idx_accounts_status_published_at
  ON accounts(status, published_at);
