// keep in sync with the plugin's osList.ts

export const OS_IDS = [
    "alpine",
    "arch",
    "artix",
    "cachyos",
    "debian",
    "elementary",
    "endeavouros",
    "fedora",
    "garuda",
    "gentoo",
    "kdeneon",
    "kubuntu",
    "linux",
    "linuxmint",
    "lubuntu",
    "manjaro",
    "mxlinux",
    "nixos",
    "opensuse",
    "popos",
    "qubes",
    "rhel",
    "slackware",
    "solus",
    "ubuntu",
    "void",
    "xubuntu",
    "zorin",
    "freebsd",
    "macos",
    "win10",
    "win11",
    "win7",
] as const;

export type OsId = typeof OS_IDS[number];

const OS_ID_SET: ReadonlySet<string> = new Set(OS_IDS);

export function isOsId(value: unknown): value is OsId {
    return typeof value === "string" && OS_ID_SET.has(value);
}
