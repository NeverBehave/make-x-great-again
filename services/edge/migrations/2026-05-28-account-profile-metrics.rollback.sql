-- Rollback of 2026-05-28-account-profile-metrics.sql
-- D1/SQLite rollback compatibility: leave the nullable columns in place.
-- They are inert once the Worker/admin code no longer reads them.

-- Optional cleanup if you want to clear captured profile metrics:
-- UPDATE accounts SET account_created_at=NULL,
--                     account_age_days=NULL,
--                     followers_count=NULL,
--                     following_count=NULL;
