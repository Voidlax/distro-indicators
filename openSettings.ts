/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPluginModal } from "@components/settings/tabs";

export function openPluginSettings() {
    openPluginModal(Vencord.Plugins.plugins.DistroIndicators);
}
