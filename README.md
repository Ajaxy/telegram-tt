# Edit Radar for Telegram Web A

> A feature suggestion for Telegram by [@sixbillionherselfxx](https://github.com/sixbillionherselfxx), built on top of the official [Telegram Web A](https://github.com/Ajaxy/telegram-tt) client. Ready-to-implement code, GPL v3.

**Edit Radar makes it visible when an old message was quietly edited long after it was sent.**

## Why

Today a message edited a month later looks almost the same as one fixed a second after sending: a small grey "edited" mark. Nobody scrolls back to check old posts or pinned messages.

- In August 2026, Telegram was briefly removed from the App Store. As media reported from Pavel Durov's posts, someone planted illegal content by editing an old message in an active public chat, and members didn't notice ([Engadget](https://www.engadget.com/2230482/telegram-ceo-says-takedown-extortionist-was-responsible-for-the-app-being-briefly-delisted-by-apple/), [ppc.land](https://ppc.land/apple-briefly-drops-telegram-from-app-store-after-planted-illegal-content/)).
- The same trick works on a smaller scale every day: a pinned link in a study group or a channel post gets swapped weeks later.
- Users have been asking for edit visibility for years: [bugs.telegram.org/c/39229](https://bugs.telegram.org/c/39229) has 51 upvotes and has stayed open since April 2024 without an official reply.

## What it does

1. **Banner in the chat.** When an old message was edited recently, a banner appears above the chat: *"An old message was edited 1 month later · Show"*. Several edits: *"3 old messages were edited"*.
2. **Show → scroll and highlight.** Show scrolls the chat to the message and outlines it in amber. The outline fades on its own. The cross dismisses the banner.
3. **Amber label.** Instead of the grey "edited", late edits get an amber *"edited 1 month later"* label.
4. **Context menu.** Under the usual "edited …" line, a second line shows *"sent Aug 31 · edited 1 month later"*.
5. **Quiet by default.** Edits made within 24 hours of sending (typo fixes) are ignored. The banner only reports late edits from the last 7 days, and edits you've already seen don't come back.

## Demo

Video (30 s, silent): [media/edit-radar-demo.mp4](media/edit-radar-demo.mp4)

## How it works

Every Telegram message already carries two timestamps: when it was sent (`date`) and when it was last edited (`edit_date`) ([API docs](https://core.telegram.org/constructor/message)). Edit Radar compares them on the client.

- **No AI, no server changes, no new API calls.** Hidden edits (`edit_hide`) are respected.
- **Private.** Which edits you've seen is stored only on your device (local storage).
- **Reduced motion.** With the system "reduce motion" setting or Telegram animations turned off, the radar icon doesn't pulse and the highlight appears without animation.
- **Light and dark themes** have their own amber colors.

## Settings in code

| Constant | File | Default |
|---|---|---|
| `LATE_EDIT_THRESHOLD` | `src/util/editRadar.ts` | 24 hours |
| `EDIT_RADAR_LOOKBACK` | `src/util/editRadar.ts` | 7 days |

Texts are in `src/assets/localization/fallback.strings` (keys `EditRadar…`).

## Changed files

- `src/util/editRadar.ts`: radar logic (new).
- `src/components/middle/panes/EditRadarPane.tsx`, `.module.scss`: the banner (new).
- `src/components/middle/MiddleHeaderPanesIsland.tsx`: banner added to the header panes.
- `src/components/middle/message/MessageMeta.*`: amber label.
- `src/components/middle/message/Message.*`: amber highlight.
- `src/components/middle/message/LastEditTimeMenuItem.tsx`, `TimeMenuItem.module.scss`: context menu line.
- `src/styles/themes.json`, `_variables.scss`, `index.scss`: amber colors for light and dark themes.
- `src/assets/localization/fallback.strings`, `src/types/language.d.ts`: texts.

Full diff against upstream: [compare with Ajaxy/telegram-tt](https://github.com/Ajaxy/telegram-tt/compare/master...sixbillionherselfxx:telegram-tt:master).

## Limits

- The radar sees only messages the client has loaded for the chat (recent history).
- It shows *that* and *when* a message was edited, not the previous text: Telegram doesn't send old versions to regular members.
- "Seen" state is per device.

## Run locally

```sh
git clone https://github.com/sixbillionherselfxx/telegram-tt.git
cd telegram-tt
npm install
echo 'TELEGRAM_API_ID=your_id' > .env
echo 'TELEGRAM_API_HASH=your_hash' >> .env
npm run dev
```

Get the API ID and hash on [my.telegram.org](https://my.telegram.org), then open http://localhost:1234.

---

*The original Telegram Web A README follows below.*

# Telegram Web A

This project won the first prize 🥇 at [Telegram Lightweight Client Contest](https://contest.com/javascript-web-3) and now is an official Telegram client available to anyone at [web.telegram.org/a](https://web.telegram.org/a).

According to the original contest rules, it has nearly zero dependencies and is fully based on its own [Teact](https://github.com/Ajaxy/teact) framework (which re-implements React paradigm). It also uses a custom version of [GramJS](https://github.com/gram-js/gramjs) as an MTProto implementation.

The project incorporates lots of technologically advanced features, modern Web APIs and techniques: WebSockets, Web Workers and WebAssembly, multi-level caching and PWA, voice recording and media streaming, cryptography and raw binary data operations, optimistic and progressive interfaces, complicated CSS/Canvas/SVG animations, reactive data streams, and so much more.

Feel free to explore, provide feedback and contribute.

## Local setup

```sh
mv .env.example .env

npm i
```

Obtain API ID and API hash on [my.telegram.org](https://my.telegram.org) and populate the `.env` file.

## Dev mode

```sh
npm run dev
```

### Invoking API from console

Start your dev server and locate GramJS worker in the console context.

All constructors and functions available in global `GramJs` variable.

Run `npm run gramjs:tl full` to get access to all available Telegram methods.

Example usage:
``` javascript
await invoke(new GramJs.help.GetAppConfig())
```

### Dependencies
* [GramJS](https://github.com/gram-js/gramjs) ([MIT License](https://github.com/gram-js/gramjs/blob/master/LICENSE))
* [fflate](https://github.com/101arrowz/fflate) ([MIT License](https://github.com/101arrowz/fflate/blob/master/LICENSE))
* [cryptography](https://github.com/spalt08/cryptography) ([Apache License 2.0](https://github.com/spalt08/cryptography/blob/master/LICENSE))
* [emoji-data](https://github.com/iamcal/emoji-data) ([MIT License](https://github.com/iamcal/emoji-data/blob/master/LICENSE))
* [twemoji-parser](https://github.com/jdecked/twemoji-parser) ([MIT License](https://github.com/jdecked/twemoji-parser/blob/master/LICENSE.md))
* [tlottie](https://github.com/dkaraush/tlottie) ([MIT License](https://github.com/dkaraush/tlottie/))
* [opus-recorder](https://github.com/chris-rudmin/opus-recorder) ([Various Licenses](https://github.com/chris-rudmin/opus-recorder/blob/master/LICENSE.md))
* [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) ([MIT License](https://github.com/kozakdenys/qr-code-styling/blob/master/LICENSE))
* [music-metadata](https://github.com/Borewit/music-metadata) ([MIT License](https://github.com/Borewit/music-metadata/blob/master/LICENSE.txt))
* [Tiptap](https://github.com/ueberdosis/tiptap) ([MIT License](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md))
* [marked](https://github.com/markedjs/marked) ([MIT License](https://github.com/markedjs/marked/blob/master/LICENSE.md))
* [lowlight](https://github.com/wooorm/lowlight) ([MIT License](https://github.com/wooorm/lowlight/blob/main/license))
* [idb-keyval](https://github.com/jakearchibald/idb-keyval) ([Apache License 2.0](https://github.com/jakearchibald/idb-keyval/blob/main/LICENCE))
* [fasttextweb](https://github.com/karmdesai/fastTextWeb)
* fastblur

## Bug reports and Suggestions
If you find an issue with this app, let Telegram know using the [Suggestions Platform](https://bugs.telegram.org/c/4002).
