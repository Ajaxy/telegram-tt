import type { LangCode } from '../../../types';

export function getSuggestedLanguage() {
  let suggestedLanguage = navigator.language.toLowerCase();

  if (suggestedLanguage && suggestedLanguage !== 'pt-br') {
    suggestedLanguage = suggestedLanguage.substr(0, 2);
  }

  return suggestedLanguage as LangCode;
}
