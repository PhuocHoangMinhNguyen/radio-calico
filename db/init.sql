CREATE TABLE IF NOT EXISTS song_ratings (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  thumbs_up INT NOT NULL DEFAULT 0,
  thumbs_down INT NOT NULL DEFAULT 0,
  UNIQUE(song_title, song_artist)
);

CREATE TABLE IF NOT EXISTS song_votes (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(song_title, song_artist, ip_address)
);

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('hls', 'network', 'media', 'app', 'unknown')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'fatal')),
  message TEXT NOT NULL,
  details TEXT,
  metadata JSONB,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_id ON error_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_created ON error_logs(session_id, created_at DESC);

-- Retention policy: automatically delete error_logs older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_error_logs ON error_logs;
CREATE TRIGGER trigger_cleanup_error_logs
  AFTER INSERT ON error_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_error_logs();
