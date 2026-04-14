import type { LangFn } from '../../../../util/localization';

export function getStyleTitle(lang: LangFn, tone: string, fallbackTitle: string) {
  if (!tone) return fallbackTitle;
  const capitalizedTone = tone.charAt(0).toUpperCase() + tone.slice(1);
  const key = `AiMessageEditorStyle${capitalizedTone}`;
  // @ts-ignore - Dynamic lang key
  const translated = lang(key);
  return translated !== key ? translated : fallbackTitle;
}
