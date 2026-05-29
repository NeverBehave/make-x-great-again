-- Indexes for admin ordering by captured profile metrics.

CREATE INDEX IF NOT EXISTS idx_accounts_status_created_at ON accounts(status, account_created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_status_followers ON accounts(status, followers_count);
CREATE INDEX IF NOT EXISTS idx_accounts_status_following ON accounts(status, following_count);
