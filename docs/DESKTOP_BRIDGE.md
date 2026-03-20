# Desktop bridge (`__telegramDesktopBridge`)

For Electron (or other hosts) that must keep **one** MTProto session in the telegram-tt **web worker**, use this bridge from the **renderer** process after the app is logged in.

## Globals (after bundle load)

- `window.callApi` — existing fork hook; posts to GramJS worker.
- `window.__telegramDesktopBridge` — small surface for desktop integrations:
  - **`ping()`** → `Promise<{ ok: true, callApiReady: true }>` (present once the lazy `import('../api/gramjs')` ran).
  - **`downloadDeferredMedia(metadata)`** → same as `callApi('downloadDeferredMedia', metadata)`.

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

- Stop using a **second** GramJS client (e.g. Node) with the **same** auth keys while this client is connected — see `AUTH_KEY_DUPLICATED` / `docs/LOCALDB_EXPORT_WORKER.md`.
