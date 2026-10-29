-- Positions module: current-or-past position terms, keyed by adult and organization. Adults only.
-- There is deliberately no index by member_id alone: the API never answers "where does this adult serve".
CREATE TABLE position_assignments (
  member_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  position_code TEXT NOT NULL,
  last_name_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (member_id, organization_id, position_code)
);
