-- Replaces the dirty_at timestamp with a monotonic revision counter.
--
-- The timestamp version lost writes: COALESCE(dirty_at, ?) left an already-set
-- marker untouched, so a write landing between the publisher reading the rows
-- and clearing the flag was covered by the flag it then cleared. That row sat
-- in D1 and never reached a snapshot.
--
-- With a counter, every write increments `revision` unconditionally, and the
-- publisher stores the revision it actually built. dirty is simply
-- revision > published_revision, which a concurrent write can only make true.

DROP TABLE IF EXISTS publish_state;

CREATE TABLE publish_state (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    revision          INTEGER NOT NULL DEFAULT 0,
    published_revision INTEGER NOT NULL DEFAULT -1,
    published_at      INTEGER,
    row_count         INTEGER NOT NULL DEFAULT 0
);

-- published_revision starts behind revision so the first cron tick publishes an
-- empty snapshot. Without that, clients fetching before the first write get a
-- missing object rather than an empty one.
INSERT INTO publish_state (id, revision, published_revision, published_at, row_count)
VALUES (1, 0, -1, NULL, 0);
