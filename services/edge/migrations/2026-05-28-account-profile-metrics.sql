-- Persist X account profile metrics captured by the extension so the admin
-- console can show registration time, followers, and following counts.

ALTER TABLE accounts ADD COLUMN account_created_at TEXT;
ALTER TABLE accounts ADD COLUMN account_age_days INTEGER;
ALTER TABLE accounts ADD COLUMN followers_count INTEGER;
ALTER TABLE accounts ADD COLUMN following_count INTEGER;
