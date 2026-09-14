import { isOsId, OS_IDS } from "./enum";
import { Bucket, checkRateLimit } from "./ratelimit";
import { SNAPSHOT_CACHE_KEY } from "./cache";
import { publishSnapshot, sweepExpired } from "./snapshot";

export interface Env {
    DB: D1Database;
    SNAPSHOTS: KVNamespace;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    STATE_SECRET: string;
    SNAPSHOT_KEY: string;
}

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 5 * 60 * 1000;

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
};

function json(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        ...init,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...CORS,
            ...init.headers,
        },
    });
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
    const declared = Number(request.headers.get("Content-Length") ?? 0);
    if (declared > 2048) return null;

    try {
        const raw = await request.text();
        if (raw.length > 2048) return null;

        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

function b64url(bytes: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, "-").replace(/\
}

async function hmac(env: Env, data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(env.STATE_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

async function makeState(env: Env): Promise<string> {
    const payload = `${Date.now() + STATE_TTL_MS}.${randomToken()}`;
    return `${payload}.${await hmac(env, payload)}`;
}

async function verifyState(env: Env, state: string): Promise<boolean> {
    const dot = state.lastIndexOf(".");
    if (dot < 0) return false;

    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);

    const expected = await hmac(env, payload);
    if (sig.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return false;

    const expiry = Number(payload.split(".")[0]);
    return Number.isFinite(expiry) && expiry > Date.now();
}

async function authenticate(request: Request, env: Env): Promise<string | null> {
    const header = request.headers.get("Authorization");
    if (!header) return null;

    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    const row = await env.DB
        .prepare("SELECT user_id, expires_at FROM tokens WHERE token_hash = ?")
        .bind(await sha256Hex(token))
        .first<{ user_id: string; expires_at: number; }>();

    if (!row || row.expires_at < Date.now()) return null;
    return row.user_id;
}

async function handleAuthStart(env: Env): Promise<Response> {
    return json({ state: await makeState(env), clientId: env.DISCORD_CLIENT_ID });
}

async function handleAuthCallback(request: Request, env: Env, redirectUri: string): Promise<Response> {
    const body = await readJsonObject(request);
    if (!body) return json({ error: "malformed body" }, { status: 400 });

    const { code, state } = body;
    if (typeof code !== "string" || typeof state !== "string") {
        return json({ error: "code and state required" }, { status: 400 });
    }

    if (!await verifyState(env, state)) {
        return json({ error: "invalid or expired state" }, { status: 400 });
    }

    const form = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
    });

    if (!tokenRes.ok) {
        return json({ error: "discord rejected the code" }, { status: 401 });
    }

    const { access_token: accessToken } = await tokenRes.json<{ access_token?: string; }>();
    if (!accessToken) return json({ error: "no access token" }, { status: 502 });

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) return json({ error: "identity lookup failed" }, { status: 502 });

    const { id: userId } = await userRes.json<{ id?: string; }>();
    if (!userId) return json({ error: "no user id" }, { status: 502 });

    const token = randomToken();
    const now = Date.now();

    await env.DB
        .prepare("INSERT INTO tokens (token_hash, user_id, issued_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(await sha256Hex(token), userId, now, now + TOKEN_TTL_MS)
        .run();

    return json({ token, userId });
}

async function handleSetDistro(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const userId = await authenticate(request, env);
    if (!userId) return json({ error: "unauthorized" }, { status: 401 });

    const body = await readJsonObject(request);
    if (!body) return json({ error: "malformed body" }, { status: 400 });

    if (!isOsId(body.distro)) {
        return json({ error: "thats not a real OS id" }, { status: 400 });
    }

    const now = Date.now();
    await env.DB.batch([
        env.DB
            .prepare(`INSERT INTO distros (user_id, distro, updated_at) VALUES (?, ?, ?)
                      ON CONFLICT(user_id) DO UPDATE SET distro = excluded.distro, updated_at = excluded.updated_at`)
            .bind(userId, body.distro, now),
        env.DB.prepare("UPDATE publish_state SET revision = revision + 1 WHERE id = 1"),
    ]);

    ctx.waitUntil(publishSnapshot(env));

    return json({ ok: true, distro: body.distro });
}

async function handleDeleteDistro(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const userId = await authenticate(request, env);
    if (!userId) return json({ error: "unauthorized" }, { status: 401 });

    await env.DB.batch([
        env.DB.prepare("DELETE FROM distros WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM tokens WHERE user_id = ?").bind(userId),
        env.DB.prepare("UPDATE publish_state SET revision = revision + 1 WHERE id = 1"),
    ]);

    ctx.waitUntil(publishSnapshot(env));

    return json({ ok: true });
}

async function handleSnapshot(env: Env, ctx: ExecutionContext): Promise<Response> {
    const cache = caches.default;
    const cacheKey = new Request(SNAPSHOT_CACHE_KEY);

    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const body = await env.SNAPSHOTS.get(env.SNAPSHOT_KEY);

    const payload = body ?? JSON.stringify({ version: 1, generatedAt: 0, count: 0, users: {} });

    const res = new Response(payload, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=900, max-age=300",
            ...CORS,
        },
    });

    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
}

async function handleGetMe(request: Request, env: Env): Promise<Response> {
    const userId = await authenticate(request, env);
    if (!userId) return json({ error: "unauthorized" }, { status: 401 });

    const row = await env.DB
        .prepare("SELECT distro, updated_at FROM distros WHERE user_id = ?")
        .bind(userId)
        .first<{ distro: string; updated_at: number; }>();

    return json({ userId, distro: row?.distro ?? null, updatedAt: row?.updated_at ?? null });
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS });
        }

        const redirectUri = `${url.origin}/auth/callback`;

        const method = request.method === "HEAD" ? "GET" : request.method;
        const route = `${method} ${url.pathname}`;

        const bucket: Bucket | null =
            route.startsWith("POST /auth") ? "auth"
                : (route === "PUT /me" || route === "DELETE /me") ? "write"
                    : null;

        if (bucket) {
            const { ok, retryAfter } = await checkRateLimit(request, env, bucket);
            if (!ok) {
                return json({ error: "slow down, too many requests" }, {
                    status: 429,
                    headers: { "Retry-After": String(retryAfter) },
                });
            }
        }

        switch (route) {
            case "GET /snapshot.json":
                return handleSnapshot(env, ctx);

            case "GET /os-ids":
                return json({ ids: OS_IDS });

            case "POST /auth/start":
                return handleAuthStart(env);

            case "POST /auth/callback":
                return handleAuthCallback(request, env, redirectUri);

            case "GET /me":
                return handleGetMe(request, env);

            case "PUT /me":
                return handleSetDistro(request, env, ctx);

            case "DELETE /me":
                return handleDeleteDistro(request, env, ctx);

            default:
                return json({ error: "not found" }, { status: 404 });
        }
    },

    async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(Promise.all([publishSnapshot(env), sweepExpired(env)]));
    },
};
