# Telebiz Language System Integration

## Overview

Telebiz now supports Telegram's global language switching system. When users change the app language, Telebiz components will automatically display in the selected language.

## How It Works

### Current Implementation

1. **Integration Hook**: `useTelebizLang()` now integrates with Telegram's main language system
2. **Fallback System**: If a Telebiz key doesn't exist in the main system, it falls back to our hardcoded English pack
3. **Seamless Experience**: Users can switch languages in Telegram settings and Telebiz will follow

### Language Key Structure

All Telebiz language keys follow the pattern: `TelebizPanel.{Section}.{Feature}`

Examples:
- `TelebizPanel.Overview.Title`
- `TelebizPanel.CRM.AddToCRM`
- `TelebizPanel.Templates.UseTemplate`

## Adding New Languages

### Option 1: Add to Telegram's Main System (Recommended)

To fully integrate with Telegram's language system:

1. **Add keys to language types** (`src/types/language.d.ts`):
   ```typescript
   export interface LangPair {
     // ... existing keys
     'TelebizPanel.Overview': undefined;
     'TelebizPanel.CRM': undefined;
     // ... add all Telebiz keys
   }
   ```

2. **Add translations to fallback strings** (`src/assets/localization/fallback.strings`):
   ```
   "TelebizPanel.Overview" = "Overview";
   "TelebizPanel.CRM" = "CRM";
   ```

3. **Add translations to other language files** as needed

### Option 2: Create Language-Specific Packs

Create language-specific translation files:

```typescript
// src/components-telebiz/lang/translations/es.ts
export const telebizSpanishTranslations = {
  'TelebizPanel.Overview': 'Resumen',
  'TelebizPanel.CRM': 'CRM',
  // ... all translations
};
```

Then update `useTelebizLang` to use these packs based on the current language.

## Usage in Components

```typescript
import { useTelebizLang } from '../lang/useTelebizLang';

const MyComponent = () => {
  const lang = useTelebizLang();
  
  return (
    <div>
      <h1>{lang('TelebizPanel.Overview.Title')}</h1>
      <p>{lang('TelebizPanel.Overview.Description')}</p>
    </div>
  );
};
```

## Benefits

1. **Automatic Language Switching**: Telebiz follows Telegram's language settings
2. **Consistent UX**: Same language switching behavior as the rest of Telegram
3. **Maintainable**: Uses Telegram's existing language infrastructure
4. **Fallback Support**: Always has English fallbacks if translations are missing

## Future Enhancements

- Add more language packs (French, German, etc.)
- Support for RTL languages
- Pluralization support for dynamic content
- Context-aware translations 