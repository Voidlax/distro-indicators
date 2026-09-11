import { SNAPSHOT_CACHE_KEY } from "./cache";
import type { Env } from "./index";

// capture the revision before rows so a mid-build write stays pending
export async function publishSnapshot(env: Env): Promise<void> {
    const state = await env.DB
        .prepare("SELECT revision, published_revision FROM publish_state WHERE id = 1")
        .first<{ revision: number; published_revision: number; }>();

    if (!state || state.revision <= state.published_revision) return;

    const buildingRevision = state.revision;

    const { results } = await env.DB
        .prepare("SELECT user_id, distro FROM distros")
        .all<{ user_id: string; distro: string; }>();

    const users: Record<string, string> = {};
    for (const row of results) users[row.user_id] = row.distro;

    const body = JSON.stringify({
        version: 1,
        generatedAt: Date.now(),
        count: results.length,
        users,
    });

    await env.SNAPSHOTS.put(env.SNAPSHOT_KEY, body);

    // don't let a slower build roll back a newer published revision
    await env.DB
        .prepare(`UPDATE publish_state
                     SET published_revision = ?, published_at = ?, row_count = ?
                   WHERE id = 1 AND published_revision < ?`)
        .bind(buildingRevision, Date.now(), results.length, buildingRevision)
        .run();

    // this must match handleSnapshot's fixed cache key
    await caches.default.delete(new Request(SNAPSHOT_CACHE_KEY));
}

export async function sweepExpired(env: Env): Promise<void> {
    await env.DB
        .prepare("DELETE FROM tokens WHERE expires_at < ?")
        .bind(Date.now())
        .run();
}
