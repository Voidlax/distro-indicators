-- OAuth state is now a signed, stateless token verified in the Worker, so the
-- table it used is dead. Dropping it removes the only unauthenticated write
-- path into the database.
DROP TABLE IF EXISTS oauth_states;
