# Modifications to Telegram Web A

This is a modified version of [Telegram Web A](https://github.com/Ajaxy/telegram-tt), licensed under GPL-3.0.

## Summary

**`getLocalDbData()` has been removed** (reverted to match upstream `localDb` surface). Remaining fork hooks: `window.callApi`, `window.getGlobal`, `window.getActions` (see `src/global/index.ts`).

## Modified Files

### 1. `src/global/index.ts`
Exposed `window.callApi`, `window.getGlobal`, and `window.getActions` for external access.

## Usage

```javascript
// DEBUG builds only: direct reference to worker localDb (not serialized)
// Or use window.getGlobal / window.getActions / window.callApi for app APIs
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
