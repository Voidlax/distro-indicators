<div align="center">

# DistroIndicators

ever wanted to flex that you use arch (btw)? that you get off on recompiling your kernel every morning on gentoo? or just want a feature that should be native to discord yet isn't because discord only cares about your wallet and how many nitro exclusive features they can shove down your throat?

### introducing **DistroIndicators**!

</div>

forked from the lovely PlatformIndicators plugin, and wired into my own backend, it saves your operating system to a database then serves you a custom OS badge that shows up for everyone!

below is a genuine example of its capabilities, from two satisfied users:

<div align="center">

![example](docs/example.png)

<sub>never use arch it fucks up your sanity</sub>

</div>

---

## installing

its a userplugin, so you need vencord (or equicord) built from source. follow the
[custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/), then drop
these files into `src/userplugins/distroIndicators/` and build. enable it, turn off
the built-in PlatformIndicators, and pick your OS in the settings.

if it cant reach the backend, add `api.5ylens.lol` to vencords CSP allowlist through
the `customCspRules` setting.

---

## faq

**where is windows 8?**\
No.

**this looks like vibecoded ai slop**\
it is. i would lowkey sacrifice my firstborn to Anthropic. claude my bbg <3

**my distro isnt in the list**\
if by any chance your ancient ass distro from 2011 themed around Hannah Montana isn't in the list, you can always create an issue, and i'll take a look at it.

**why do i have to pick my OS manually? can't it detect it by itself?**\
unfortunately no. discord can only know you're on desktop, web, phone, vr or console. there's nothing that we can read internally that detects the actual operating system. blame discord for that, not me. so please DON'T larp.

**im a dual boot cuck. what about me?**\
at the moment, only one OS can be chosen at a time. i'm planning a feature where you can store two OSes and toggle between them on the go, but for now, just pick the OS you use the most.

**why is this a thing?**\
i was bored.

**i found a bug**\
open an issue, ill take a look at it, and maybe, just maybe, fix it.

---

## credits

this is a fork of vencords built-in **PlatformIndicators**, most of the rendering logic is theirs. full credit to the people who actually put in some effort into making it rather than bullying claude for 6 hours: **Vendicated**, **Nuckyz**, **kemo** and **sunnie**.

- icons from [simple-icons](https://github.com/simple-icons/simple-icons) (CC0) and wikimedia commons
- nyarch logo traced from [nyarch linux](https://nyarchlinux.moe)

<div align="center">

<sub>GPL-3.0-or-later</sub>

</div>
