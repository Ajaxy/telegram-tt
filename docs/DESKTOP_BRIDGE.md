# Desktop bridge (`__telegramDesktopBridge`)

For Electron (or other hosts) that embed telegram-tt **logged in** in a webview and need the **webview session** to approve a **second** MTProto client (linked GramJS in your main process), use this bridge.

Media bytes are **not** streamed through this fork; use your **linked** client for downloads. This fork only exposes **`acceptLoginToken`** plus the usual **`window.callApi`** (e.g. `getLocalDbMediaMetadata`).

## Deploy

The bridge exists **only in this fork’s build**. If **`window.__telegramDesktopBridge`** is missing, rebuild/redeploy this branch.

## Globals (after bundle load)

- **`window.callApi`** — posts to the GramJS worker (see `MODIFICATIONS.md` for exported methods).
- **`window.__telegramDesktopBridge`** — attached **synchronously** (stub first, wired when GramJS loads):
  - **`ready`** — `Promise<void>` when `callApi` is active.
  - **`ping()`** — `false` until wired, then `true`.
  - **`acceptLoginToken(tokenBase64, expires?)`** — `Promise<void>`: opens a **confirmation modal**; on **Allow**, worker runs `auth.acceptLoginToken`. Resolves when the modal is **queued**, not after the user confirms.

**Host usage:** `await window.__telegramDesktopBridge.ready` (or `ping() === true`) before calling **`acceptLoginToken`**.

### Token encoding

Use **standard base64** or **URL-safe base64** for the raw `LoginToken` bytes from `auth.exportLoginToken`.

### `telegram-session:link-result`

After the user responds:

```ts
// Success (RPC ok after Allow):
{ type: 'telegram-session:link-result', ok: true }

// Cancel / close modal:
{ type: 'telegram-session:link-result', ok: false, error: 'User cancelled' }

// RPC error after Allow:
{ type: 'telegram-session:link-result', ok: false, error: '…' }
```

Posted with `window.postMessage(..., '*')`. Preload should filter on **`data?.type === 'telegram-session:link-result'`**.

## Security

Only load on **trusted origins**; XSS is full account access.

## Related

- Second client must use a **new** session (`exportLoginToken` + `acceptLoginToken`), not cloned web `sessionData`, or you risk **`AUTH_KEY_DUPLICATED`**.
- Worker load: [LOCALDB_EXPORT_WORKER.md](LOCALDB_EXPORT_WORKER.md).
