import type { Env } from "./index";

const WINDOW_SECONDS = 60;

const LIMITS = {
    write: 10,
    auth: 20,
} as const;

export type Bucket = keyof typeof LIMITS;

export interface RateLimitResult {
    ok: boolean;
    retryAfter: number;
}

function clientKey(request: Request, bucket: string): string {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const window = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    return `rl:${bucket}:${ip}:${window}`;
}

export async function checkRateLimit(request: Request, env: Env, bucket: Bucket): Promise<RateLimitResult> {
    const limit = LIMITS[bucket];
    const key = clientKey(request, bucket);

    const current = Number(await env.SNAPSHOTS.get(key)) || 0;

    if (current >= limit) {
        return { ok: false, retryAfter: WINDOW_SECONDS };
    }

    await env.SNAPSHOTS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS * 2 });

    return { ok: true, retryAfter: 0 };
}
