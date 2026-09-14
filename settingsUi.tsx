/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { useAwaiter } from "@utils/react";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Button, OAuth2AuthorizeModal, openModal, React, SearchableSelect, showToast, Toasts, UserStore } from "@webpack/common";

import { API_BASE, completeAuth, deleteDistro, getToken, setDistro, setToken, startAuth } from "./api";
import { getOs, PICKABLE } from "./osList";
import { getDistroFor, refresh, setLocalDistro, subscribe } from "./store";

const logger = new Logger("DistroIndicators");

async function authorize(): Promise<boolean> {
    const { state, clientId } = await startAuth();

    return new Promise(resolve => {
        openModal(props => (
            <OAuth2AuthorizeModal
                {...props}
                scopes={["identify"]}
                responseType="code"
                redirectUri={`${API_BASE}/auth/callback`}
                permissions={0n}
                clientId={clientId}
                cancelCompletesFlow={false}
                callback={async (response: { location: string; }) => {
                    try {
                        const code = new URL(response.location).searchParams.get("code");
                        if (!code) throw new Error("no code returned");

                        const { token } = await completeAuth(code, state);
                        await setToken(token);
                        resolve(true);
                    } catch (err) {
                        logger.error("authorization failed", err);
                        showToast("couldnt link ur account, try again", Toasts.Type.FAILURE);
                        resolve(false);
                    }
                }}
            />
        ));
    });
}

export function OsPicker() {
    const [token, , tokenPending] = useAwaiter(getToken, { fallbackValue: undefined });
    const [busy, setBusy] = React.useState(false);

    const userId = UserStore.getCurrentUser()?.id;

    const [current, setCurrent] = React.useState<string>(() => (userId && getDistroFor(userId)) || "");

    React.useEffect(() => subscribe(() => {
        if (userId) setCurrent(getDistroFor(userId) ?? "");
    }), [userId]);

    React.useEffect(() => { refresh(); }, []);

    const options = React.useMemo(() => [
        { label: "none", value: "" },
        ...PICKABLE.map(os => ({ label: `${os.label} (${os.group})`, value: os.id })),
    ], []);

    async function choose(value: string) {
        if (value === current) return;
        if (value === "" && !current) return;

        setBusy(true);
        try {
            if (!await getToken() && !await authorize()) return;

            if (value === "") {
                await deleteDistro();
                if (userId) setLocalDistro(userId, null);
                showToast("removed u from the list", Toasts.Type.SUCCESS);
            } else {
                await setDistro(value);
                if (userId) setLocalDistro(userId, value);
                showToast(`set to ${getOs(value)?.label ?? value}`, Toasts.Type.SUCCESS);
            }

            setCurrent(value);
            await refresh(true);
        } catch (err) {
            logger.error("failed to save", err);
            showToast(err instanceof Error ? err.message : "couldnt save that", Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section>
            <HeadingSecondary>the OS you want to show</HeadingSecondary>

            <SearchableSelect
                placeholder="search for ur OS"
                options={options}
                value={options.find(o => o.value === current)?.value}
                onChange={choose}
                maxVisibleItems={8}
                closeOnSelect
                isDisabled={busy || tokenPending}
            />

            <Paragraph style={{ marginTop: 8 }}>
                dual boot? this shows one OS, not whatever ur booted into right now.
                just pick the one you wanna be known for.
            </Paragraph>

            <Paragraph style={{ marginTop: 8 }}>
                heads up, picking an OS makes it public. the whole list of discord
                ids and their OS is a file anyone can download, so only set this if
                ur fine with that. pick "none" to remove urself.
            </Paragraph>

            {token && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    look={Button.Looks.LINK}
                    style={{ marginTop: 8, padding: 0 }}
                    disabled={busy}
                    onClick={async () => {
                        await setToken(null);
                        showToast("unlinked. ur entry is still up though, pick \"none\" to actually delete it", Toasts.Type.MESSAGE);
                    }}
                >
                    unlink this account
                </Button>
            )}
        </section>
    );
}
