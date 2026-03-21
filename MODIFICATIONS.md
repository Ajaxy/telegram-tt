# Modifications to Telegram Web A

This is a modified version of [Telegram Web A](https://github.com/Ajaxy/telegram-tt), licensed under GPL-3.0.

## Summary

1. Exposes **`localDb`** (full or media-only slice) via **`window.callApi`**. Serialization runs on the **GramJS worker**; see [docs/LOCALDB_EXPORT_WORKER.md](docs/LOCALDB_EXPORT_WORKER.md).
2. **`window.callApi`**, **`getGlobal`**, **`getActions`**, and **`window.__telegramDesktopBridge`** for desktop embeds. Bridge: **`ready`**, **`ping`**, **`acceptLoginToken`** (second-session link). See [docs/DESKTOP_BRIDGE.md](docs/DESKTOP_BRIDGE.md).
3. **`callApi('acceptLoginToken', tokenBase64)`** — worker invokes `auth.acceptLoginToken` after the user confirms in-app. Runtime constructor comes from [`src/lib/gramjs/tl/apiTl.ts`](src/lib/gramjs/tl/apiTl.ts) (`auth.acceptLoginToken` line). If you see **`AcceptLoginToken is not a constructor`**, clear **`localStorage`** key **`GramJs:apiCache`** and reload.

## Modified / added files (high level)

- `src/api/gramjs/localDb.ts` — `getLocalDbMediaMetadata`, `getLocalDbData` (+ yielding).
- `src/api/gramjs/methods/index.ts` — exports `acceptLoginToken` + localDb methods.
- `src/api/gramjs/methods/client.ts` — `acceptLoginToken`.
- `src/lib/gramjs/tl/apiTl.ts` — `auth.acceptLoginToken` TL line for runtime `Api`.
- `src/global/index.ts` — window hooks + bridge.
- `src/global/actions/ui/misc.ts`, `tabState`, `actions`, `DesktopSessionLinkModal`, `Main.tsx`, `Story.tsx`, i18n — link modal + `telegram-session:link-result` postMessage.
- `docs/DESKTOP_BRIDGE.md`, `docs/LOCALDB_EXPORT_WORKER.md`
- **CI:** `.github/workflows/deploy-web-s3.yml` only (no upstream `package-and-publish` workflow in this fork). `.gitignore` ignores `.github/workflows/*` except `deploy-web-s3.yml` so other workflow files stay untracked.

## Usage

```javascript
const { documents, photos, webDocuments } = await window.callApi('getLocalDbMediaMetadata');
const localDb = await window.callApi('getLocalDbData'); // heavy — throttle
```

## License

GPL-3.0. **Original**: Telegram FZ-LLC and Ajaxy. **Modifications**: see your organization notice in-repo.
