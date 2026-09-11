/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { UserStore } from "@webpack/common";

export const API_BASE = "https://api.5ylens.lol";

const AUTH_STORE_KEY = "distro-indicators-auth";

export interface Snapshot {
    version: number;
    generatedAt: number;
    count: number;
    users: Record<string, string>;
}

type AuthMap = Record<string, string>;

// keyed per account so switching accounts doesn't carry the token across
export async function getToken(): Promise<string | undefined> {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return undefined;

    const auth = await DataStore.get<AuthMap>(AUTH_STORE_KEY);
    return auth?.[id];
}

export async function setToken(token: string | null): Promise<void> {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return;

    await DataStore.update<AuthMap>(AUTH_STORE_KEY, auth => {
        auth ??= {};
        if (token === null) delete auth[id];
        else auth[id] = token;
        return auth;
    });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = { Accept: "application/json", ...init.headers as Record<string, string> };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body) headers["Content-Type"] = "application/json";

    const res = await fetch(API_BASE + path, { ...init, headers });

    if (!res.ok) {
        const detail = await res.json().catch(() => null) as { error?: string; } | null;
        throw new Error(detail?.error ?? `request failed (${res.status})`);
    }

    return res.json() as Promise<T>;
}

export function startAuth(): Promise<{ state: string; clientId: string; }> {
    return request("/auth/start", { method: "POST" });
}

export function completeAuth(code: string, state: string): Promise<{ token: string; userId: string; }> {
    return request("/auth/callback", { method: "POST", body: JSON.stringify({ code, state }) });
}

export function setDistro(distro: string): Promise<{ ok: true; distro: string; }> {
    return request("/me", { method: "PUT", body: JSON.stringify({ distro }) });
}

export function deleteDistro(): Promise<{ ok: true; }> {
    return request("/me", { method: "DELETE" });
}

export async function fetchSnapshot(): Promise<Snapshot> {
    // revalidate against the edge instead of trusting a stale local copy
    const res = await fetch(`${API_BASE}/snapshot.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
    return res.json();
}
