/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModalLazy } from "@utils/modal";
import { Modal, Text } from "@webpack/common";

import { openPluginSettings } from "./openSettings";

export function showWelcomeModal() {
    openModalLazy(async () => modalProps => (
        <Modal
            {...modalProps}
            title="DistroIndicators"
            actions={[
                {
                    text: "set my OS",
                    variant: "primary",
                    onClick: () => {
                        modalProps.onClose();
                        openPluginSettings();
                    },
                },
                {
                    text: "later",
                    variant: "link",
                    onClick: modalProps.onClose,
                },
            ]}
        >
            <div style={{ padding: "16px" }}>
                <Text variant="text-md/normal">
                    this shows what OS someone runs instead of the plain desktop
                    icon, but only for people who set one.
                </Text>
                <Text variant="text-md/normal" style={{ marginTop: 12 }}>
                    it does nothing until you pick yours. wanna set it now?
                </Text>
            </div>
        </Modal>
    ));
}
