-- One row per opted-in user. The whole product is this table.
CREATE TABLE IF NOT EXISTS distros (
    user_id    TEXT PRIMARY KEY,
    distro     TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Opaque bearer tokens, stored hashed so a database leak does not hand out
-- working credentials. One row per issued token; a user may hold several
-- (different machines), and they expire.
CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    issued_at  INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON tokens(expires_at);

-- Single-row bookkeeping for the snapshot publisher. `dirty_at` is set on every
-- write and cleared once a snapshot containing that change reaches R2, so a
-- failed publish retries instead of silently dropping the change.
CREATE TABLE IF NOT EXISTS publish_state (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    dirty_at     INTEGER,
    published_at INTEGER,
    row_count    INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO publish_state (id, dirty_at, published_at, row_count)
VALUES (1, NULL, NULL, 0);

-- Short-lived one-time values binding an OAuth callback to the request that
-- started it. Rows are deleted on use and swept by expiry.
CREATE TABLE IF NOT EXISTS oauth_states (
    state      TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
