#!/usr/bin/env bash
# One-shot provisioning for the distro-indicators backend.
#
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
# Creates the D1 database and R2 bucket, writes the real database id into
# wrangler.toml, applies migrations, and deploys. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN first}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID first}"

DB_NAME="distro-indicators"
BUCKET="distro-indicators-snapshots"

say() { printf '\n== %s\n' "$1"; }

say "creating D1 database (ignored if it exists)"
npx wrangler d1 create "$DB_NAME" 2>/dev/null || echo "already exists, continuing"

say "resolving database id"
DB_ID=$(npx wrangler d1 list --json | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
    const row = JSON.parse(s).find(d => d.name === process.argv[1]);
    if (!row) { console.error("database not found"); process.exit(1); }
    process.stdout.write(row.uuid ?? row.id);
});
' "$DB_NAME")

[[ -n $DB_ID ]] || { echo "could not resolve database id" >&2; exit 1; }
echo "database id: $DB_ID"

say "writing database id into wrangler.toml"
sed -i "s|^database_id = .*|database_id = \"$DB_ID\"|" wrangler.toml
grep -n '^database_id' wrangler.toml

say "creating R2 bucket (ignored if it exists)"
npx wrangler r2 bucket create "$BUCKET" 2>/dev/null || echo "already exists, continuing"

say "applying migrations to the remote database"
npx wrangler d1 migrations apply "$DB_NAME" --remote

say "deploying the worker"
npx wrangler deploy

cat <<'NEXT'

== done

Two things left, both needing your Discord app:

  1. In the Discord developer portal, OAuth2 -> Redirects, add:
       <worker-url>/auth/callback
     using the worker URL printed above.

  2. Set the secrets (paste the value when prompted; it is not echoed):
       npx wrangler secret put DISCORD_CLIENT_ID
       npx wrangler secret put DISCORD_CLIENT_SECRET

NEXT
