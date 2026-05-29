# Telegram Web A, Reimagined in Svelte

This repository is an active migration of Telegram Web A from its original
Teact-based interface toward a Svelte-powered client.

Telegram Web A is already a serious piece of browser engineering: MTProto over
web workers, rich media playback, voice recording, PWA behavior, caching,
animation-heavy interfaces, and a custom lightweight UI runtime. This branch
keeps that foundation and moves the user interface toward Svelte step by step.

## Why This Branch Exists

The goal is not a quick visual clone. The goal is to preserve the real Telegram
client behavior while replacing the UI layer with Svelte in a way that can be
built, reviewed, and improved continuously.

Current focus areas:

- Svelte app bootstrap using the existing Telegram state and action system.
- Auth screens wired to real global actions.
- Left column chat navigation and search powered by existing selectors.
- Middle column preview, message focus, draft handling, and a minimal composer.
- Right column profile summary connected to real peer state.
- Vite build path for the Svelte client.

The original Teact/Webpack app is still present while the migration is in
progress. That makes the branch useful for incremental work instead of a risky
all-at-once rewrite.

## What Works Today

- `npm run dev` starts the original Telegram Web A development build.
- `npm run dev:svelte` starts the Svelte/Vite migration build.
- `npm run build:svelte` produces the Svelte build in `dist-svelte`.
- The Svelte shell reads from the real global store.
- Chat selection, folders, search, auth flow, right column visibility, message
  preview, draft saving, and basic sending are already connected to existing
  actions.

This is still a migration branch, so feature parity is intentionally incomplete.
The remaining heavy work is mostly in message rendering, the full composer,
media flows, right-column details, settings, and secondary navigation screens.

## Quick Start

```sh
mv .env.example .env
npm i
```

Create your Telegram API credentials at [my.telegram.org](https://my.telegram.org)
and add them to `.env`.

Run the Svelte migration client:

```sh
npm run dev:svelte
```

Build the Svelte client:

```sh
npm run build:svelte
```

Run the original client:

```sh
npm run dev
```

## Project Map

- `src/main.svelte.ts` boots the Svelte app.
- `src/App.svelte` decides which high-level Svelte screen is visible.
- `src/global/store.svelte.ts` bridges Svelte reactivity to the existing global
  state.
- `src/components/auth/svelte` contains the migrated auth screens.
- `src/components/left/**/svelte` contains migrated left-column pieces.
- `src/components/middle/svelte` contains the active middle-column migration.
- `src/components/right/svelte` contains the active right-column migration.
- `vite.config.ts` owns the Svelte/Vite build path.

## Migration Strategy

The fastest practical path is incremental:

1. Finish the middle column: scrollable message list, complete composer, message
   rendering, media previews, reply/edit state, and search inside chats.
2. Finish right/common components: profile panels, shared avatar/info blocks,
   reusable UI primitives, and real status handling.
3. Finish left-side flows: archived chats, settings, new group/channel flows,
   contacts, and the remaining search tabs.
4. Clean up bundling: chunk splitting, legacy dependency warnings, and temporary
   bridge code.

That approach keeps the app buildable while the UI moves from Teact to Svelte.

## Useful Commands

```sh
npm run dev:svelte
npm run build:svelte
npm run check:svelte
npm run dev
npm run build:dev
```

`check:svelte` is useful, but this branch currently treats `build:svelte` as the
main migration safety check because several legacy dependencies still produce
noisy compatibility warnings in the Vite path.

## Original Project

Telegram Web A won first prize at the
[Telegram Lightweight Client Contest](https://contest.com/javascript-web-3) and
became an official Telegram client at
[web.telegram.org/a](https://web.telegram.org/a).

The original app is based on [Teact](https://github.com/Ajaxy/teact), a small
React-like runtime, and a custom version of
[GramJS](https://github.com/gram-js/gramjs) for MTProto.

## Core Dependencies

- [GramJS](https://github.com/gram-js/gramjs)
- [fflate](https://github.com/101arrowz/fflate)
- [cryptography](https://github.com/spalt08/cryptography)
- [emoji-data](https://github.com/iamcal/emoji-data)
- [twemoji-parser](https://github.com/twitter/twemoji-parser)
- [rlottie](https://github.com/Samsung/rlottie)
- [opus-recorder](https://github.com/chris-rudmin/opus-recorder)
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling)
- [mp4box](https://github.com/gpac/mp4box.js)
- [music-metadata-browser](https://github.com/Borewit/music-metadata-browser)
- [lowlight](https://github.com/wooorm/lowlight)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- fasttextweb
- webp-wasm
- fastblur

## Contributing

Good migration work in this branch is small, honest, and easy to review. Prefer
moving one surface at a time, reuse existing selectors and actions, keep the
legacy app working, and verify the Svelte build before opening a pull request.

Bug reports for the official Telegram Web A client should still go through
Telegram's [Suggestions Platform](https://bugs.telegram.org/c/4002).
