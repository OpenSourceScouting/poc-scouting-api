-- Membership module: only the fields the membership check returns. Adults only.
CREATE TABLE membership_status (
  member_id TEXT PRIMARY KEY,
  last_name_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
