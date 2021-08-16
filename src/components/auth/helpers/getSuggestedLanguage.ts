import { LangCode } from '../../../types';

export function getSuggestedLanguage() {
  let suggestedLanguage = navigator.language;

  if (suggestedLanguage && suggestedLanguage !== 'pt-br') {
    suggestedLanguage = suggestedLanguage.substr(0, 2);
  }

  return suggestedLanguage as LangCode;
}
