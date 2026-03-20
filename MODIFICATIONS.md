# Modifications to Telegram Web A

This is a modified version of [Telegram Web A](https://github.com/Ajaxy/telegram-tt), licensed under GPL-3.0.

## Summary

Exposes `localDb` (or a media-only slice) via `callApi`. Serialization runs on the **GramJS Web Worker** (same thread as MTProto); large sync `JSON.stringify` can starve recv. We **yield between top-level buckets** and document why in [docs/LOCALDB_EXPORT_WORKER.md](docs/LOCALDB_EXPORT_WORKER.md).

## Modified Files

### 1. `src/api/gramjs/localDb.ts`
- `getLocalDbMediaMetadata()` — **preferred** for scrapers: `documents`, `photos`, `webDocuments` only (smaller, faster).
- `getLocalDbData()` — full clone; **throttle** (e.g. ≤1 call/s).

### 2. `src/api/gramjs/methods/index.ts`
Exports the above methods for `callApi`.

### 3. `src/global/index.ts`
`window.callApi`, `window.getGlobal`, `window.getActions`.

## Usage

```javascript
// Preferred: media metadata only (async)
const { documents, photos, webDocuments } = await window.callApi('getLocalDbMediaMetadata');

// Full dump — heavy; throttle
const localDb = await window.callApi('getLocalDbData');
```

## Purpose

Enables external applications to access Telegram media metadata for:
- Data archival and backup
- Content analysis
- Integration tools
- Research purposes

## Technical Details

See `LOCALDB_SOLUTION.md` for complete technical documentation.

## License

This modified version maintains the original GPL-3.0 license.

**Original Copyright**: Copyright (c) 2021-present, Telegram FZ-LLC and Ajaxy  
**Modifications**: Copyright (c) 2026, [Your Organization/Name]

All modifications are licensed under GPL-3.0.
