-- Indexes for the admin review queue's default + new server-side sorts.
--   last_scored : default "时间" sort + keyset cursor tie-breaker (the existing
--                 time index is on published_at, which the queue doesn't order by).
--   confidence  : "AI 置信" sort.
-- The "风险等级" (severity) sort is a computed expression over verdict_label +
-- confidence and can't be indexed directly; it rides the dedup scan. The
-- "举报人数" sort is backed by idx_reports_handle_reporter_norm (already present).

CREATE INDEX IF NOT EXISTS idx_accounts_status_last_scored ON accounts(status, last_scored);
CREATE INDEX IF NOT EXISTS idx_accounts_status_confidence ON accounts(status, confidence);
