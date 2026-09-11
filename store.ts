/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { fetchSnapshot } from "./api";

const logger = new Logger("DistroIndicators");

let users: Record<string, string> = {};
let lastFetch = 0;

const REFRESH_MS = 30 * 60 * 1000;

// presence stores don't know about this data, so components need a signal of
// their own or a snapshot that lands after render never gets drawn
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emit(): void {
    for (const listener of listeners) {
        try {
            listener();
        } catch (err) {
            logger.error("listener threw", err);
        }
    }
}

export function getDistroFor(userId: string): string | undefined {
    return users[userId];
}

export function setLocalDistro(userId: string, distro: string | null): void {
    if (distro) users[userId] = distro;
    else delete users[userId];
    emit();
}

export async function refresh(force = false): Promise<void> {
    if (!force && Date.now() - lastFetch < REFRESH_MS) return;

    try {
        const snapshot = await fetchSnapshot();
        users = snapshot.users ?? {};
        lastFetch = Date.now();
        emit();
    } catch (err) {
        logger.error("failed to fetch snapshot", err);
    }
}
