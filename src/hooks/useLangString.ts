import * as langProvider from '../util/langProvider';
import { useState } from '../lib/teact/teact';

export default (langCode: string | undefined, key: string): string | undefined => {
  const [translation, setTranslation] = useState<string>();

  if (langCode) {
    langProvider
      .getTranslationForLangString(langCode, key)
      .then(setTranslation);
  }

  return translation;
};
