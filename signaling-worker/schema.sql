-- Neon PostgreSQL Schema for Drop
-- Run this in your Neon dashboard SQL editor

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                  -- Google sub ID
  email TEXT,
  name TEXT,
  picture TEXT,
  plan TEXT DEFAULT 'free',             -- 'free' | 'pro'
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_usage (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  bytes_transferred BIGINT DEFAULT 0,
  bonus_bytes BIGINT DEFAULT 0,         -- earned from watching ads
  ad_watches_today INT DEFAULT 0,       -- how many ads watched today
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS transfer_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  direction TEXT NOT NULL,              -- 'sent' | 'received'
  transferred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast usage lookups
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transfer_history_user ON transfer_history(user_id, transferred_at DESC);
