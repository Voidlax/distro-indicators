DROP TABLE IF EXISTS publish_state;

CREATE TABLE publish_state (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    revision          INTEGER NOT NULL DEFAULT 0,
    published_revision INTEGER NOT NULL DEFAULT -1,
    published_at      INTEGER,
    row_count         INTEGER NOT NULL DEFAULT 0
);

INSERT INTO publish_state (id, revision, published_revision, published_at, row_count)
VALUES (1, 0, -1, NULL, 0);
