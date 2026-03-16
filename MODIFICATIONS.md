# Modifications to Telegram Web A

This is a modified version of [Telegram Web A](https://github.com/Ajaxy/telegram-tt), licensed under GPL-3.0.

## Summary

Added a minimal API to expose Telegram's internal media metadata (localDb) for external access.

**Changes**: 3 files, 33 lines added

## Modified Files

### 1. `src/api/gramjs/localDb.ts`
Added `getLocalDbData()` function to serialize and export localDb with proper handling of BigInt and Uint8Array types.

### 2. `src/api/gramjs/methods/index.ts`
Exported the `getLocalDbData` method.

### 3. `src/global/index.ts`
Exposed `window.callApi`, `window.getGlobal`, and `window.getActions` for external access.

## Usage

```javascript
// Access media metadata
const localDb = await window.callApi('getLocalDbData');
const document = localDb.documents[documentId];
// Access: accessHash, fileReference, dcId, size, fileName, etc.
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
