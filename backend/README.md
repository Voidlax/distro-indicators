# DistroIndicators backend

the cloudflare worker behind the plugin. stores `discord_id → os` and publishes the
whole thing as one public json file that clients fetch on startup. only here if u
wanna run ur own instance instead of the public one, the plugin works fine without
touching any of this.

## running ur own

1. a cloudflare account (free) and a discord app
   ([developer portal](https://discord.com/developers/applications))
2. copy `wrangler.template.toml` to `wrangler.toml` and fill in the blanks, or just
   run `./setup.sh` which makes the resources and fills the ids for u
3. set the three secrets (none of them live in a file):
   ```
   wrangler secret put DISCORD_CLIENT_ID
   wrangler secret put DISCORD_CLIENT_SECRET
   wrangler secret put STATE_SECRET   # any long random string
   ```
4. add `<your-domain>/auth/callback` as a redirect URI in the discord app
5. point the plugins `API_BASE` (in `../api.ts`) at ur host, and add that host
   to vencords CSP allowlist

## how it stays free

everything runs on cloudflares free tier, workers + D1 (the db) + KV (the published
file). they all **fail closed**, so if u ever hit a limit the requests just error
until the daily reset, they never bill. no card on the account = nothing to charge.
worst case under abuse is the plugin going quiet for a day.

## security

assumes the source is public and an attacker can see every endpoint (they can, from
the network traffic anyway), so nothing relies on hiding the api:

- writes need a bearer token that only comes from discord oauth, and the user id
  comes from discords `/users/@me`, never the request body, so u cant set an OS for an
  account u dont own
- tokens stored sha-256 hashed. oauth state is a signed stateless HMAC token so the
  unauthenticated `/auth/start` never touches the db
- per-IP rate limits on the write/auth paths, request bodies capped
- the public snapshot is edge-cached on a fixed key so u cant force worker runs by
  spamming random query strings

## layout

- `src/index.ts` — the routes (auth, /me, snapshot)
- `src/snapshot.ts` — rebuilds the public json when data changes, on a 15-min cron
- `src/ratelimit.ts` — per-IP limits
- `src/enum.ts` — the closed OS list, kept in sync with the plugins `osList.ts`
- `migrations/` — D1 schema
