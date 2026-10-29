-- SYT module: only the fields the SYT check returns. Adults only; no youth record is ever stored.
-- last_name_hash is HMAC-SHA256(NAME_HASH_KEY, normalized last name), never the name itself.
CREATE TABLE syt_status (
  member_id TEXT PRIMARY KEY,
  last_name_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
