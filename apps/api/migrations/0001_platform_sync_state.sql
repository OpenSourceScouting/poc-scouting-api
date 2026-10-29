-- Platform: one row recording when the dataset was last synced from Scouting America's systems.
-- Every answer returns this same value as `asOf`, so it can never distinguish a real ID from a fake one.
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  as_of TEXT NOT NULL
);
