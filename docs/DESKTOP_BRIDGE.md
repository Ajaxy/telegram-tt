# Desktop bridge (`__telegramDesktopBridge`)

For Electron (or other hosts) that must keep **one** MTProto session in the telegram-tt **web worker**, use this bridge from the **renderer** process after the app is logged in.

## Deploy

The bridge exists **only in this fork’s build**. If **`window.__telegramDesktopBridge`** is missing entirely, the site is serving an **old bundle** — rebuild from branch `EN-6083-feature/localdb-api-and-s3-deploy` (or equivalent) and **redeploy** (e.g. S3).

## Globals (after bundle load)

- `window.callApi` — existing fork hook; posts to GramJS worker.
- `window.__telegramDesktopBridge` — set **synchronously** on `window` (stub first, then wired when GramJS loads):
  - **`ready`** — `Promise<void>` that resolves when `callApi` and download methods are active.
  - **`ping()`** → `false` until GramJS is wired, then **`true`**.
  - **`startDownload(metadata)`** → `callApi('startDownloadDeferredMedia', metadata)` → resolves **`{ downloadId }`** immediately; bytes stream as **`window.postMessage`** events (see below). Before `ready`, rejects with a clear error.
  - **`downloadDeferredMedia(metadata)`** → same as `callApi('downloadDeferredMedia', metadata)` (single buffered result). Before `ready`, rejects.
  - **`acceptLoginToken(tokenBase64, expires?)`** → `Promise<void>`: opens a **confirmation modal** in the web UI; if the user allows, the worker calls `auth.acceptLoginToken` so a **separate** GramJS client (e.g. Electron with `auth.exportLoginToken`) can complete QR-style login with a **new** session. Does **not** call Telegram until the user taps **Allow**. Resolves immediately after **queuing** the modal (not after the user confirms). Before `ready`, rejects like other bridge methods.

**Host usage:** `await window.__telegramDesktopBridge.ready` (or wait until `ping() === true`) before calling downloads — avoids races and false “bridge missing” checks.

### Token encoding

Pass the same **raw login token bytes** your requesting client got from `LoginToken`, encoded as **standard base64** or **URL-safe base64** (with `-` / `_`); the fork accepts both.

### `telegram-session:link-result` (after user responds to link modal)

Listen on the **page** `window` (same as chunk messages). The fork posts:

```ts
// User tapped Allow and auth.acceptLoginToken succeeded:
window.postMessage({ type: 'telegram-session:link-result', ok: true }, '*');

// User tapped Cancel / closed modal:
window.postMessage({ type: 'telegram-session:link-result', ok: false, error: 'User cancelled' }, '*');

// RPC failed after Allow (error text from Telegram / GramJS):
window.postMessage({ type: 'telegram-session:link-result', ok: false, error: '…' }, '*');
```

Also **`ok: false`, `error: 'Missing token'`** if the confirm action ran without a pending token (edge case).

**Preload:** filter on `data?.type === 'telegram-session:link-result'` (only trusted same-origin webview if possible).

## IPC / `Object.entries` errors in your host app

If your `MessagingBackend` does `Object.entries(somePayload)` and **`somePayload` is `undefined`**, you get `Cannot convert undefined or null to object`. Guard with `Object.entries(payload ?? {})` or validate before respond — that path is in **your** Electron code, not telegram-tt.

## `startDownload` → `tg-download-chunk` messages

After `startDownload` resolves with `{ downloadId }`, listen on the **page** `window`:

Payload shape (main thread → `window.postMessage`, **structured clone**, no transfer list):

- **Data parts:** `done: false`, `chunk: ArrayBuffer` (copy), `chunkSize` / `byteLength` &gt; 0, `offset` = byte offset in file.
- **Terminal:** `done: true`, `chunk` omitted, `totalSize` / `mimeType` on success, or `error` on failure.

Chunks are sent in **separate** worker → main messages so ArrayBuffers are not mis-ordered with other batched updates.

**Always filter** — many scripts call `postMessage`; ignore anything not from this bridge:

```ts
window.addEventListener('message', (ev) => {
  const d = ev.data;
  if (d?.type !== 'tg-download-chunk' || d?.bridge !== 'telegram-tt-v2') return;

  const { downloadId, offset, byteLength, chunkSize, chunk, done, state, error, mimeType, totalSize } = d;

  if (state === 'done' || state === 'error' || done === true) {
    /* close stream; check error */
    return;
  }

  const n = chunkSize ?? byteLength ?? 0;
  if (state === 'data' && n > 0 && chunk instanceof ArrayBuffer) {
    /* append chunk */
  }
});
```

If you see **`chunkSize: 0`** and **`done` undefined** on events **without** `bridge: 'telegram-tt-v2'`, those are **not** from telegram-tt (e.g. React, extensions, or an **old** deploy before this field existed). Redeploy the fork and filter as above.

Avoid starting **many** `startDownload` calls in parallel unless each stream is keyed by **`downloadId`** — interleaved chunks are expected.

Optional **`metadata.downloadId`** lets you correlate without waiting for the promise.

## `downloadDeferredMedia`

**Input:** `ApiDesktopDeferredMedia` (`src/api/types/desktopBridge.ts`)

- `id`, `accessHash` — decimal strings (may exceed JS safe integer).
- `fileReference` — standard or URL-safe base64.
- `dcId` — number.
- `mediaType` — `photo` uses `InputPhotoFileLocation`; `document` | `video` | `audio` | `voice` | `other` use `InputDocumentFileLocation`.
- `thumbSize` — optional; photos default to `y`; full files use `''` (omit or empty).
- `size` — optional byte hint for the downloader (recommended for large files).

**Output:** Same shape as progressive `downloadMedia`: `{ dataBlob: '', arrayBuffer, mimeType?, fullSize? }` so the worker can **transfer** the `ArrayBuffer` to the UI thread.

## Security

The bridge is powerful. Only load your build on **trusted origins**; treat XSS as full account access.

## Related

- **`AUTH_KEY_DUPLICATED`:** Do not run two MTProto clients with **cloned** `sessionData` / the same auth key while both are connected. A **second client** linked via **`exportLoginToken` + `acceptLoginToken`** uses a **new** Telegram session (new keys) — that is supported.
- Worker load and blocking: [docs/LOCALDB_EXPORT_WORKER.md](LOCALDB_EXPORT_WORKER.md).
