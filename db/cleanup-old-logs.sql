-- Cleanup script for error_logs retention policy
-- This script should be run periodically via cron job (recommended: daily at 2 AM)
--
-- Usage:
--   psql -U postgres -d radio_calico -f cleanup-old-logs.sql
--
-- Or via environment variables:
--   PGPASSWORD=$PGPASSWORD psql -U $PGUSER -d $PGDATABASE -f cleanup-old-logs.sql

BEGIN;

-- Delete error logs older than 30 days
DELETE FROM error_logs
WHERE created_at < NOW() - INTERVAL '30 days';

COMMIT;

-- Optionally, run VACUUM to reclaim disk space
VACUUM ANALYZE error_logs;
